/**
 * tgListener.js
 * Telegram user client that listens to curated alpha groups and routes
 * token calls through the full enrichment + LLM cascade
 * (processCandidateFromSignals) before Social Scout agents evaluate them.
 *
 * Uses Opsi A from update-intruction.md:
 *   - gramjs TelegramClient with user session (not bot API)
 *   - Can read any group the account has joined
 *   - ONLY reads messages, never posts
 *
 * Required ENV:
 *   TG_API_ID           — from my.telegram.org
 *   TG_API_HASH         — from my.telegram.org
 *   TG_SESSION_STRING   — generated session string (see setup instructions)
 *   TG_ALPHA_GROUPS     — comma-separated group IDs or usernames
 *   SOCIAL_SCOUT_ENABLED — 'true' to activate (default: false)
 *   TG_MAX_TRADES_PER_GROUP_HOUR — rate limit per group (default: 5)
 *   TG_LIQUIDITY_FLOOR_USD — skip if liquidity below this (default: 10000)
 */

import { parseTokenCall } from './tokenParser.js';
import { db } from '../db/connection.js';
import { sendTelegram } from '../telegram/send.js';
import { escapeHtml } from '../format.js';

// Per-group rate limiter (in-memory, resets on restart)
// Structure: Map<groupId, { count: number, windowStartMs: number }>
const groupRateLimiter = new Map();

const MAX_TRADES_PER_HOUR = parseInt(process.env.TG_MAX_TRADES_PER_GROUP_HOUR || '5');
const LIQUIDITY_FLOOR     = parseInt(process.env.TG_LIQUIDITY_FLOOR_USD || '10000');

// De-dupe: prevent same CA from the same group within 5 minutes
const recentSignals = new Map(); // key: `${groupId}:${ca}` → timestamp

/**
 * Check if a group has exceeded its hourly trade rate limit.
 * @param {string} groupId
 * @returns {boolean} true if rate-limited (should skip)
 */
function isGroupRateLimited(groupId) {
  const now = Date.now();
  const HOUR_MS = 60 * 60 * 1000;

  let state = groupRateLimiter.get(groupId);
  if (!state || (now - state.windowStartMs) > HOUR_MS) {
    // Reset window
    state = { count: 0, windowStartMs: now };
    groupRateLimiter.set(groupId, state);
  }

  if (state.count >= MAX_TRADES_PER_HOUR) {
    return true;
  }

  state.count++;
  return false;
}

/**
 * Check if this CA was recently emitted from this group (de-dupe within 5min).
 */
function isRecentDuplicate(groupId, ca) {
  const key = `${groupId}:${ca}`;
  const now = Date.now();
  const DEDUP_MS = 5 * 60 * 1000;

  // Prune old entries
  for (const [k, ts] of recentSignals) {
    if (now - ts > DEDUP_MS) recentSignals.delete(k);
  }

  if (recentSignals.has(key)) return true;
  recentSignals.set(key, now);
  return false;
}

/**
 * Increment total_calls for a TG group in the performance table.
 */
function trackGroupCall(groupId, groupName = '') {
  try {
    db.prepare(`
      INSERT INTO tg_group_performance (group_id, group_name, total_calls, updated_at_ms)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(group_id) DO UPDATE SET
        total_calls = total_calls + 1,
        group_name = COALESCE(excluded.group_name, group_name),
        updated_at_ms = excluded.updated_at_ms
    `).run(groupId, groupName, Date.now());
  } catch (e) {
    // Non-fatal: table might not exist yet in older installs
    console.warn('[TG] could not track group call:', e.message);
  }
}

/**
 * Check if a TG group is demoted (win_rate too low to trust).
 */
function isGroupDemoted(groupId) {
  try {
    const row = db.prepare(
      "SELECT trust_level FROM tg_group_performance WHERE group_id = ?"
    ).get(groupId);
    return row?.trust_level === 'demoted';
  } catch {
    return false;
  }
}

/**
 * Update win/loss and auto-demote group if win_rate drops below 35%.
 * Called externally when a Social Scout position closes.
 *
 * @param {string} groupId
 * @param {boolean} isWin
 */
export function recordGroupTradeResult(groupId, isWin) {
  try {
    if (isWin) {
      db.prepare(`
        UPDATE tg_group_performance SET
          traded = traded + 1, wins = wins + 1,
          win_rate = CAST(wins + 1 AS REAL) / (traded + 1),
          updated_at_ms = ?
        WHERE group_id = ?
      `).run(Date.now(), groupId);
    } else {
      db.prepare(`
        UPDATE tg_group_performance SET
          traded = traded + 1, losses = losses + 1,
          win_rate = CAST(wins AS REAL) / (traded + 1),
          updated_at_ms = ?
        WHERE group_id = ?
      `).run(Date.now(), groupId);
    }

    // Auto-demote if traded >= 20 and win_rate < 0.35
    const row = db.prepare(
      'SELECT traded, win_rate FROM tg_group_performance WHERE group_id = ?'
    ).get(groupId);
    if (row && row.traded >= 20 && row.win_rate < 0.35) {
      db.prepare(
        "UPDATE tg_group_performance SET trust_level = 'demoted' WHERE group_id = ?"
      ).run(groupId);
      console.warn(`[TG] Group ${groupId} auto-demoted (win_rate ${(row.win_rate * 100).toFixed(0)}% < 35%)`);
    }
  } catch (e) {
    console.error('[TG] recordGroupTradeResult error:', e.message);
  }
}

/**
 * Process a parsed message: extract CAs and pipe each one through the full
 * enrichment + LLM cascade via processCandidateFromSignals().
 *
 * Guard rails (cheap checks) run first to avoid unnecessary API calls:
 *   1. Group demote check
 *   2. Rate limit check
 *   3. De-dupe check (same CA from same group within 5 min)
 *
 * Then for each valid CA:
 *   - processCandidateFromSignals() runs enrichment (GMGN, Jupiter, holders,
 *     Twitter narrative) followed by the DeepSeek T1 → Grok T2 LLM cascade.
 *   - The orchestrator's own sharedSignalFeed.broadcast() call propagates the
 *     enriched signal (including real llm_confidence) to Social Scout agents.
 *   - source: 'tg_alpha' and sourceMeta (groupId etc.) are preserved so that
 *     agentRunner routing and positions.js win/loss tracking still work.
 */
/**
 * Format notifikasi awal saat CA terdeteksi dari grup alpha.
 * Dikirim SEGERA sebelum pipeline LLM — user dapat pantau real-time.
 */
function formatScoutCallAlert({ ca, groupId, groupName, senderId, text }) {
  const gName  = groupName || groupId;
  const caShort = `${ca.slice(0, 6)}...${ca.slice(-4)}`;
  const gmgnUrl = `https://gmgn.ai/sol/token/${ca}`;
  const dexUrl  = `https://dexscreener.com/search?q=${ca}`;

  // Ekstrak nama/ticker dari pesan jika ada (pola: $TICKER atau TICKER)
  const tickerMatch = text.match(/\$([A-Z]{2,10})/) || text.match(/\b([A-Z]{2,8})\b/);
  const ticker = tickerMatch ? ` ($${tickerMatch[1]})` : '';

  const preview = text.slice(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return [
    `📡 <b>TG Alpha Call Detected!</b>`,
    ``,
    `👥 <b>Grup:</b> ${escapeHtml(gName)}`,
    `👤 <b>Caller ID:</b> <code>${escapeHtml(String(senderId))}</code>`,
    `🪙 <b>Token${ticker}:</b>`,
    `   <code>${ca}</code>`,
    `   <a href="${gmgnUrl}">GMGN</a> · <a href="${dexUrl}">DexScreener</a>`,
    ``,
    `💬 <b>Pesan:</b>`,
    `<i>${preview}${text.length > 200 ? '…' : ''}</i>`,
    ``,
    `⏳ <i>Menganalisis dengan LLM… tunggu update otomatis.</i>`,
  ].join('\n');
}

/**
 * Format update notifikasi setelah pipeline LLM selesai.
 */
function formatScoutCallUpdate({ ca, groupId, groupName, senderId, text, pipelineResult }) {
  const gName  = groupName || groupId;
  const caShort = `${ca.slice(0, 6)}...${ca.slice(-4)}`;
  const gmgnUrl = `https://gmgn.ai/sol/token/${ca}`;
  const dexUrl  = `https://dexscreener.com/search?q=${ca}`;

  const tickerMatch = text.match(/\$([A-Z]{2,10})/) || text.match(/\b([A-Z]{2,8})\b/);
  const ticker = tickerMatch ? ` ($${tickerMatch[1]})` : '';

  const preview = text.slice(0, 150).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Ambil hasil dari pipeline jika tersedia
  const decision   = pipelineResult?.decision   || 'SKIP';
  const confidence = pipelineResult?.confidence ? `${(pipelineResult.confidence * 100).toFixed(0)}%` : 'N/A';
  const mcap       = pipelineResult?.mcap_usd   ? `$${(pipelineResult.mcap_usd / 1000).toFixed(1)}K` : 'N/A';
  const liquidity  = pipelineResult?.liquidity_usd ? `$${(pipelineResult.liquidity_usd / 1000).toFixed(1)}K` : 'N/A';
  const holders    = pipelineResult?.holders    ?? 'N/A';
  const age        = pipelineResult?.token_age_minutes ? `${pipelineResult.token_age_minutes}m` : 'N/A';
  const reasoning  = pipelineResult?.reasoning  ? escapeHtml(String(pipelineResult.reasoning).slice(0, 200)) : null;
  const symbol     = pipelineResult?.symbol     || '';
  const runner     = pipelineResult?.runner_signal ? `\n🎯 Runner: <b>${pipelineResult.runner_signal}</b>${pipelineResult.runner_account ? ` • ${pipelineResult.runner_account}` : ''}` : '';
  const kolSignal  = pipelineResult?.kol_signal  ? `\n👁 KOL: <b>${pipelineResult.kol_signal}</b>` : '';

  const decEmoji = decision === 'BUY' ? '🟢 BUY' : decision === 'ESCALATE' ? '🟡 ESCALATE' : '🔴 SKIP';

  const lines = [
    `📡 <b>TG Alpha Call — Analisis Selesai</b>`,
    ``,
    `👥 <b>Grup:</b> ${escapeHtml(gName)}`,
    `👤 <b>Caller ID:</b> <code>${escapeHtml(String(senderId))}</code>`,
    `🪙 <b>Token${symbol ? ` ${escapeHtml(symbol)}` : ticker}:</b>`,
    `   <a href="${gmgnUrl}"><code>${ca}</code></a>`,
    ``,
    `📊 <b>Hasil LLM:</b> ${decEmoji} · Confidence: <b>${confidence}</b>${runner}${kolSignal}`,
    ``,
    `📈 <b>Metrics:</b>`,
    `   MCap: <b>${mcap}</b> · Liquidity: <b>${liquidity}</b>`,
    `   Holders: <b>${holders}</b> · Age: <b>${age}</b>`,
    reasoning ? `\n💬 <i>${reasoning}</i>` : null,
    ``,
    `💬 <b>Pesan asli:</b>`,
    `<i>${preview}${text.length > 150 ? '…' : ''}</i>`,
  ].filter(Boolean).join('\n');

  return lines;
}

async function processMessage({ text, groupId, groupName, senderId, timestamp }) {
  if (!text) return;

  // Guard 1: skip demoted groups
  if (isGroupDemoted(groupId)) {
    console.log(`[TG] group ${groupId} is demoted, skipping message`);
    return;
  }

  // Track total calls for this group (before rate-limit so the call is counted)
  trackGroupCall(groupId, groupName);

  const { addresses } = parseTokenCall(text);
  if (addresses.length === 0) return;

  // Guard 2: per-group hourly rate limit
  if (isGroupRateLimited(groupId)) {
    console.log(`[TG] group ${groupId} rate-limited (${MAX_TRADES_PER_HOUR}/h), skip`);
    return;
  }

  for (const ca of addresses) {
    // Guard 3: de-dupe within 5-minute window
    if (isRecentDuplicate(groupId, ca)) {
      console.log(`[TG] dup skip: ${ca.slice(0, 8)} from group ${groupId}`);
      continue;
    }

    console.log(`[TG] 📡 alpha call detected: ${ca.slice(0, 8)}... from group ${groupId} — routing through LLM cascade`);

    // ── Notifikasi AWAL: kirim segera sebelum pipeline ────────────────
    let alertMsgId = null;
    try {
      const alertText = formatScoutCallAlert({ ca, groupId, groupName, senderId, text });
      const sent = await sendTelegram(alertText);
      alertMsgId = sent?.message_id || null;
    } catch (notifErr) {
      console.warn(`[TG] Failed to send scout alert:`, notifErr.message);
    }

    // Route through the full pipeline: enrichment → LLM cascade → broadcast.
    // Lazy import avoids circular dependency at module load time.
    // A 60-second timeout ensures a slow external API does not stall the listener.
    const pipelinePromise = (async () => {
      const { processCandidateFromSignals } = await import('../pipeline/orchestrator.js');
      const result = await processCandidateFromSignals({
        mint: ca,
        route: 'tg_alpha',
        source: 'tg_alpha',
        sourceMeta: {
          groupId,
          groupName,
          rawMessage: text.slice(0, 200),
          senderId: String(senderId),
        },
      });
      return result;
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM pipeline timeout (60s)')), 60_000)
    );

    Promise.race([pipelinePromise, timeoutPromise])
      .then(async (pipelineResult) => {
        console.log(`[TG] ✅ pipeline complete for ${ca.slice(0, 8)}...`);

        // ── Update notifikasi dengan hasil LLM ──────────────────────
        if (alertMsgId) {
          try {
            const { bot } = await import('../telegram/bot.js');
            const { TELEGRAM_CHAT_ID, TELEGRAM_TOPIC_ID } = await import('../config.js');
            const updatedText = formatScoutCallUpdate({
              ca, groupId, groupName, senderId, text,
              pipelineResult: pipelineResult || null,
            });
            await bot.editMessageText(updatedText, {
              chat_id: TELEGRAM_CHAT_ID,
              message_id: alertMsgId,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
              ...(TELEGRAM_TOPIC_ID ? { message_thread_id: Number(TELEGRAM_TOPIC_ID) } : {}),
            });
          } catch (editErr) {
            // Non-fatal: message may have been deleted or too old to edit
            console.warn(`[TG] Could not update alert message:`, editErr.message);
          }
        }
      })
      .catch(err => console.error(`[TG] pipeline error for ${ca.slice(0, 8)}...:`, err.message));
  }
}


/**
 * Start the Telegram listener using gramjs TelegramClient (user session).
 *
 * IMPORTANT: This requires:
 *   1. Install gramjs: npm install telegram
 *   2. Generate a session string once: run the session-generator helper
 *   3. Set TG_API_ID, TG_API_HASH, TG_SESSION_STRING in .env
 *   4. Optionally set TG_ALPHA_GROUPS to comma-separated group IDs/usernames
 *      — leave empty to start in "discovery mode" (all groups logged, none traded)
 *
 * @returns {Promise<void>}
 */

// ── Runtime group registry (in-memory, populated from .env + DB on startup) ──
// Kept in a module-level Set so that /scout commands can mutate it live.
const monitoredGroups = new Set();

/**
 * Persist a group addition/removal to the tg_group_performance table so it
 * survives server restarts.
 */
function persistGroupMonitoring(groupId, enabled) {
  try {
    db.prepare(`
      INSERT INTO tg_group_performance (group_id, group_name, monitored, total_calls, updated_at_ms)
      VALUES (?, '', ?, 0, ?)
      ON CONFLICT(group_id) DO UPDATE SET
        monitored = excluded.monitored,
        updated_at_ms = excluded.updated_at_ms
    `).run(groupId, enabled ? 1 : 0, Date.now());
  } catch (e) {
    console.warn('[TG] could not persist group monitoring state:', e.message);
  }
}

/**
 * Return the control interface for the runtime group registry.
 * Used by commands.js (/scout command) to add/remove/list groups live.
 */
export function getTgListenerControl() {
  return {
    add(groupId) {
      monitoredGroups.add(String(groupId));
      persistGroupMonitoring(String(groupId), true);
    },
    remove(groupId) {
      monitoredGroups.delete(String(groupId));
      persistGroupMonitoring(String(groupId), false);
    },
    list() {
      return [...monitoredGroups];
    },
    has(groupId) {
      return monitoredGroups.has(String(groupId));
    },
  };
}

// ── Active gramjs client (set after connect, reused by /scout learn) ──
let _activeClient = null;

/**
 * Return the active gramjs TelegramClient after startTgListener() has connected.
 * Returns null if Social Scout is disabled or not yet connected.
 */
export function getActiveTgClient() {
  return _activeClient;
}

export async function startTgListener() {
  if (process.env.SOCIAL_SCOUT_ENABLED !== 'true') {
    console.log('[TG] Social Scout disabled (SOCIAL_SCOUT_ENABLED != true), skipping listener');
    return;
  }

  const apiId   = parseInt(process.env.TG_API_ID || '0');
  const apiHash = process.env.TG_API_HASH || '';
  const session = process.env.TG_SESSION_STRING || '';

  if (!apiId || !apiHash || !session) {
    console.warn('[TG] Missing TG_API_ID / TG_API_HASH / TG_SESSION_STRING — TG listener disabled');
    return;
  }

  // ── Populate runtime group registry from .env ──────────────────────────────
  const envGroups = (process.env.TG_ALPHA_GROUPS || '')
    .split(',')
    .map(g => g.trim())
    .filter(Boolean);

  for (const g of envGroups) monitoredGroups.add(g);

  // ── Also load any groups previously added via /scout add command (from DB) ──
  try {
    const dbGroups = db.prepare(
      "SELECT group_id FROM tg_group_performance WHERE monitored = 1"
    ).all();
    for (const row of dbGroups) monitoredGroups.add(row.group_id);
  } catch {
    // Table may not have monitored column on older installs — silently skip
  }

  const isDiscoveryMode = monitoredGroups.size === 0;
  if (isDiscoveryMode) {
    console.log('[TG] No groups configured — running in DISCOVERY MODE.');
    console.log('[TG] All groups will be logged with their ID and name.');
    console.log('[TG] Use /scout add <group_id> in Telegram to start monitoring a group.');
  } else {
    console.log(`[TG] Listener starting — monitoring ${monitoredGroups.size} group(s):`, [...monitoredGroups]);
  }

  // ── Dynamically import gramjs to avoid breaking startup if not installed ────
  let TelegramClient, StringSession, NewMessage;
  try {
    const tg       = await import('telegram');
    const sessions = await import('telegram/sessions/index.js');
    const events   = await import('telegram/events/index.js');
    TelegramClient = tg.TelegramClient;
    StringSession  = sessions.StringSession;
    NewMessage     = events.NewMessage;
  } catch (err) {
    console.error('[TG] gramjs not installed. Run: npm install telegram');
    console.error('[TG] listener disabled:', err.message);
    return;
  }

  const client = new TelegramClient(
    new StringSession(session),
    apiId,
    apiHash,
    { connectionRetries: 5, autoReconnect: true }
  );

  await client.connect();
  _activeClient = client;
  console.log('[TG] gramjs client connected.');

  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg?.message) return;

      const chatId   = String(msg.chatId || msg.peerId?.channelId || msg.peerId?.chatId || '');
      const senderId = String(msg.fromId?.userId || msg.senderId || 'unknown');

      // ── Resolve group name (lazily via getEntity) ──────────────────────────
      let groupName = '';
      try {
        const entity = await client.getEntity(msg.peerId);
        groupName = entity?.title || entity?.username || entity?.firstName || '';
      } catch { /* non-fatal */ }

      // ── Discovery log: print every group seen with ID + name ───────────────
      const isMonitored = monitoredGroups.size === 0
        ? false
        : [...monitoredGroups].some(g => chatId.includes(g) || g.includes(chatId));

      if (!isMonitored) {
        // Only act if the message contains a possible CA (32-44 char base58 token)
        const hasPossibleCa = /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(msg.message);
        if (hasPossibleCa) {
          console.log(
            `[TG] 🔍 UNMONITORED group — ID: ${chatId} | Name: "${groupName}" | ` +
            `Use: /scout add ${chatId}`
          );
          // Queue group for Telegram approval notification (hourly batch, max 5 per hour)
          try {
            db.prepare(`
              INSERT INTO tg_group_pending (group_id, group_name, status, first_seen_ms, last_notified_ms)
              VALUES (?, ?, 'pending', ?, 0)
              ON CONFLICT(group_id) DO UPDATE SET
                group_name = CASE WHEN excluded.group_name != '' THEN excluded.group_name ELSE group_name END
              WHERE status = 'pending'
            `).run(chatId, groupName, Date.now());
          } catch (e) {
            console.warn('[TG] could not queue pending group:', e.message);
          }
        }
        return;
      }

      await processMessage({
        text: msg.message,
        groupId: chatId,
        groupName,
        senderId,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('[TG] handler error:', err.message);
    }
  }, new NewMessage({}));
}

