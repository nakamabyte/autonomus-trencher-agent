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

// --- NEW MEMORY STRUCTURES FOR CALLER ATTRIBUTION ---
const humanCallsCache = new Map(); // key: groupId:ca, value: { callerId, callerHandle, timestamp, timeoutId }
const groupMessageBuffer = new Map(); // key: groupId, value: array of last 50 message texts

function logCallToDb(callerHandle, callerId, ca, timestamp, linkedCard, groupId) {
  try {
    db.prepare(`
      INSERT INTO tg_calls (caller_handle, caller_id, token_ca, timestamp_ms, linked_card, group_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(callerHandle, callerId, ca, timestamp, linkedCard, groupId);
  } catch (e) {
    console.warn('[TG] Failed to log call to DB:', e.message);
  }
}

function getCallerTrust(callerHandle) {
  try {
    const row = db.prepare('SELECT tier, trust_score FROM tg_caller_trust WHERE caller_handle = ?').get(callerHandle);
    if (row) return { tier: row.tier, trust_score: row.trust_score };
    return { tier: 'B', trust_score: 0.5 };
  } catch {
    return { tier: 'B', trust_score: 0.5 };
  }
}

function recordGroupSentiment(groupId) {
  const messages = groupMessageBuffer.get(groupId) || [];
  let bullish = 0;
  let bearish = 0;
  
  const bullWords = ['bull', 'buy', 'send', 'moon', 'lfg', 'gem', 'ape', 'pump'];
  const bearWords = ['bear', 'sell', 'rug', 'scam', 'jeets', 'dump', 'skip', 'trash'];
  
  for (const msg of messages) {
    const lower = msg.toLowerCase();
    let isBull = false;
    let isBear = false;
    for (const w of bullWords) { if (lower.includes(w)) { isBull = true; break; } }
    for (const w of bearWords) { if (lower.includes(w)) { isBear = true; break; } }
    if (isBull) bullish++;
    if (isBear) bearish++;
  }
  
  return { bullish, bearish };
}


// Per-group rate limiter (in-memory, resets on restart)
// Structure: Map<groupId, { count: number, windowStartMs: number }>
const groupRateLimiter = new Map();

const MAX_TRADES_PER_HOUR = parseInt(process.env.TG_MAX_TRADES_PER_GROUP_HOUR || '10');
const LIQUIDITY_FLOOR     = parseInt(process.env.TG_LIQUIDITY_FLOOR_USD || '1000');

// Fast Buy Groups: these groups bypass LLM and buy immediately on any CA call
const FAST_BUY_GROUPS = new Set(
  (process.env.TG_FAST_BUY_GROUPS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);
const FAST_BUY_SIZE_SOL = parseFloat(process.env.TG_FAST_BUY_SIZE_SOL || '0.05');

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
    `   <a href="${gmgnUrl}">GMGN</a>`,
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
    `📡 <b>TG Alpha Call — Analysis Complete</b>`,
    ``,
    `👥 <b>Group:</b> ${escapeHtml(gName)}`,
    `👤 <b>Caller ID:</b> <code>${escapeHtml(String(senderId))}</code>`,
    `🪙 <b>Token${symbol ? ` ${escapeHtml(symbol)}` : ticker}:</b>`,
    `   <a href="${gmgnUrl}"><code>${ca}</code></a>`,
    ``,
    `📊 <b>LLM Result:</b> ${decEmoji} · Confidence: <b>${confidence}</b>${runner}${kolSignal}`,
    ``,
    `📈 <b>Metrics:</b>`,
    `   MCap: <b>${mcap}</b> · Liquidity: <b>${liquidity}</b>`,
    `   Holders: <b>${holders}</b> · Age: <b>${age}</b>`,
    reasoning ? `\n💬 <i>${reasoning}</i>` : null,
    ``,
    `💬 <b>Original message:</b>`,
    `<i>${preview}${text.length > 150 ? '…' : ''}</i>`,
  ].filter(Boolean).join('\n');

  return lines;
}

async function processMessage({ text, groupId, groupName, senderId, senderUsername, timestamp, authorType }) {
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

    // ── Fast Buy mode: skip LLM for trusted groups ────────────────────
    if (FAST_BUY_GROUPS.has(String(groupId))) {
      console.log(`[TG] ⚡ FAST BUY — group ${groupId} is trusted, skipping LLM for ${ca.slice(0, 8)}...`);

      // Execute fast buy directly — bypass orchestrator entirely
      ;(async () => {
        try {
          const { createDryRunPosition, tradingMode, canOpenMorePositions } = await import('../execution/positions.js');
          const { upsertCandidate } = await import('../db/candidates.js');
          const { fetchGmgnTokenInfo } = await import('../enrichment/gmgn.js');
          const { fetchJupiterAsset } = await import('../enrichment/jupiter.js');
          const { now } = await import('../utils.js');
          const { isOnCooldown } = await import('../utils/mintCooldown.js');
          const { db } = await import('../db/connection.js');
          const { sendTelegram } = await import('../telegram/send.js');

          if (isOnCooldown(ca)) {
            console.log(`[TG-FastBuy] ${ca.slice(0, 8)}... is on cooldown, skip`);
            return;
          }

          if (!canOpenMorePositions()) {
            console.log(`[TG-FastBuy] max open positions reached, skip ${ca.slice(0, 8)}...`);
            return;
          }

          // Fetch token info BEFORE sending the alert
          const [gmgn, jupAsset] = await Promise.allSettled([
            fetchGmgnTokenInfo(ca, true, 'solana').catch(() => null),
            fetchJupiterAsset(ca).catch(() => null),
          ]);
          const gmgnData = gmgn.status === 'fulfilled' ? gmgn.value : null;
          const jupData  = jupAsset.status === 'fulfilled' ? jupAsset.value : null;

          const symbol   = gmgnData?.symbol  || jupData?.symbol  || ca.slice(0, 6);
          const name     = gmgnData?.name    || jupData?.name    || symbol;
          const mcapUsd  = gmgnData?.market_cap || jupData?.mcap || 0;
          const liqUsd   = gmgnData?.liquidity   || jupData?.liquidity || 0;
          const priceUsd = gmgnData?.price_usd   || jupData?.usdPrice || 0;
          const vol24h   = gmgnData?.volume_24h  || 0;
          const priceChange = gmgnData?.price_change_percent24h || 0;

          // Format currency helpers
          const formatCurrency = (val) => {
            if (!val) return '$0';
            if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
            if (val < 0.01) return `$${val.toFixed(6)}`;
            return `$${val.toFixed(2)}`;
          };
          const formatPct = (val) => `${val > 0 ? '+' : ''}${(val * 100).toFixed(1)}%`;

          // Send immediate alert with stats
          const gmgnUrl = `https://gmgn.ai/sol/token/${ca}`;
          const dexUrl  = `https://dexscreener.com/search?q=${ca}`;
          const preview = (text || '').slice(0, 180).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const alertText = [
            `⚡ <b>TG Fast Buy — Signal Detected</b>`,
            ``,
            `👥 <b>Group:</b> ${escapeHtml(groupName || groupId)}`,
            `👤 <b>Caller ID:</b> <code>${escapeHtml(String(senderId))}</code>`,
            `🪙 <b>Token:</b> ${escapeHtml(name)} ($${escapeHtml(symbol)})`,
            `   <a href="${gmgnUrl}"><code>${ca}</code></a>`,
            ``,
            `💬 <i>${preview}${text.length > 180 ? '…' : ''}</i>`,
            ``,
            `📊 <b>Stats</b>`,
            ` ├ USD   $${priceUsd < 0.01 ? priceUsd.toFixed(6) : priceUsd.toFixed(4)} (${formatPct(priceChange)})`,
            ` ├ MC    ${formatCurrency(mcapUsd)}`,
            ` ├ Vol   ${formatCurrency(vol24h)}`,
            ` ├ LP    ${formatCurrency(liqUsd)}`,
            ``,
            `⏳ <i>Executing fast buy (no LLM analysis)…</i>`,
          ].join('\n');

          let fastAlertMsgId = null;
          try {
            const sent = await sendTelegram(alertText);
            fastAlertMsgId = sent?.message_id || null;
          } catch (e) {
            console.warn('[TG] Fast buy alert failed:', e.message);
          }

          // Get active social_scout agents
          const activeScouts = db.prepare(`SELECT * FROM agent_dna WHERE breed = 'social_scout' AND execution_mode IN ('live', 'dry_run')`).all();
          
          if (activeScouts.length === 0) {
             console.log(`[TG-FastBuy] No active social_scout agents found. Skipping buy for ${ca.slice(0, 8)}...`);
             return;
          }

          // Build a minimal candidate object for the position record
          const candidate = {
            chain: 'solana',
            token: { mint: ca, symbol, name, chain: 'solana' },
            metrics: { priceUsd, marketCapUsd: mcapUsd, liquidityUsd: liqUsd, holderCount: 0 },
            signals: { route: 'tg_fast_buy', label: 'TG Fast Buy', hasFeeClaim: false },
            filters: { passed: true, failures: [], strategy: 'social_scout' },
            feeClaim: null, gmgn: gmgnData, jupiterAsset: jupData,
            holders: null, chart: null, savedWalletExposure: { holderCount: 0 },
            twitterNarrative: null, graduation: null, trending: null,
            createdAtMs: now(),
            sourceMeta: { groupId, groupName, rawMessage: text.slice(0, 200), senderId: String(senderId) },
          };

          // Open position for EACH active scout
          for (const scout of activeScouts) {
            const fastBuyDecision = {
              verdict: 'BUY',
              confidence: 100,
              reason: `Fast Buy: trusted group ${groupId} (${groupName || ''}) — direct signal, no LLM`,
              selected_mint: ca,
              selected_candidate_id: candidateId,
              tp_percent:  scout.tp_percent  ?? 60,
              sl_percent:  scout.sl_percent  ?? 25,
              trailing_enabled: scout.trailing_enabled === 1 || scout.trailing_enabled === true,
              trailing_percent: scout.trailing_percent ?? 20,
            };

            const mode = scout.execution_mode;
            let positionId = null;

            if (mode === 'dry_run') {
              positionId = await createDryRunPosition(candidateId, candidate, fastBuyDecision, 'tg_fast_buy', scout.id);
              console.log(`[TG-FastBuy] ✅ dry_run position #${positionId} opened for ${symbol} by ${scout.name}`);

              // Send position open notification (uses TG Alpha Scout format from notifications.js)
              const { sendPositionOpen } = await import('../telegram/send.js');
              await sendPositionOpen(positionId).catch(e => console.warn('[TG-FastBuy] sendPositionOpen failed:', e.message));

              // Update the initial alert to show position was opened
              if (fastAlertMsgId) {
                const { bot } = await import('../telegram/bot.js');
                const { TELEGRAM_CHAT_ID, TELEGRAM_TOPIC_ID } = await import('../config.js');
                const badge = '🧪 DRY RUN BUY';
                await bot.editMessageText(
                  `⚡ <b>TG Fast Buy — Signal Executed</b>\n\n` +
                  `👥 <b>Group:</b> ${escapeHtml(groupName || groupId)}\n` +
                  `🪙 <b>Token:</b> <a href="${gmgnUrl}"><code>${ca}</code></a>\n` +
                  `📛 <b>Symbol:</b> ${escapeHtml(symbol)}\n` +
                  `💎 <b>MCap:</b> $${mcapUsd ? (mcapUsd / 1000).toFixed(1) + 'K' : 'N/A'} · Liq: $${liqUsd ? (liqUsd / 1000).toFixed(1) + 'K' : 'N/A'}\n\n` +
                  `✅ <b>${badge}</b> initiated by ${scout.name}\n` +
                  `<i>Full details sent separately ↑</i>`,
                  {
                    chat_id: TELEGRAM_CHAT_ID,
                    message_id: fastAlertMsgId,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                    ...(TELEGRAM_TOPIC_ID ? { message_thread_id: Number(TELEGRAM_TOPIC_ID) } : {}),
                  }
                ).catch(e => console.warn('[TG-FastBuy] edit alert failed:', e.message));
              }

            } else if (mode === 'live') {
              const { executeLiveBuy } = await import('../execution/router.js');
              const selectedRow = { id: candidateId, candidate };
              await executeLiveBuy(selectedRow, fastBuyDecision, scout.id, [selectedRow], candidateId, null);
              console.log(`[TG-FastBuy] ✅ LIVE buy executed for ${symbol} by ${scout.name}`);

              // Update the initial alert for live mode
              if (fastAlertMsgId) {
                const { bot } = await import('../telegram/bot.js');
                const { TELEGRAM_CHAT_ID, TELEGRAM_TOPIC_ID } = await import('../config.js');
                await bot.editMessageText(
                  `⚡ <b>TG Fast Buy — Signal Executed</b>\n\n` +
                  `👥 <b>Group:</b> ${escapeHtml(groupName || groupId)}\n` +
                  `🪙 <b>Token:</b> <a href="${gmgnUrl}"><code>${ca}</code></a>\n` +
                  `📛 <b>Symbol:</b> ${escapeHtml(symbol)}\n` +
                  `💎 <b>MCap:</b> $${mcapUsd ? (mcapUsd / 1000).toFixed(1) + 'K' : 'N/A'} · Liq: $${liqUsd ? (liqUsd / 1000).toFixed(1) + 'K' : 'N/A'}\n\n` +
                  `✅ <b>🔴 LIVE BUY EXECUTED</b> by ${scout.name}\n` +
                  `<i>Full details sent separately ↑</i>`,
                  {
                    chat_id: TELEGRAM_CHAT_ID,
                    message_id: fastAlertMsgId,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                    ...(TELEGRAM_TOPIC_ID ? { message_thread_id: Number(TELEGRAM_TOPIC_ID) } : {}),
                  }
                ).catch(e => console.warn('[TG-FastBuy] edit alert failed:', e.message));
              }
            }
          }
        } catch (err) {
          console.error(`[TG-FastBuy] error for ${ca.slice(0, 8)}...:`, err.message);
        }
      })();

      continue; // skip normal LLM pipeline for this CA
    }

    // ── Normal LLM pipeline (non-fast-buy groups) ──────────────────────
    // Notifikasi AWAL: kirim segera sebelum pipeline ────────────────
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
      const sentiment = recordGroupSentiment(groupId);
      const trust = getCallerTrust(senderUsername);
      const callerMeta = {
        callerHandle: senderUsername,
        callerId: senderId,
        trustTier: trust.tier,
        trustScore: trust.trust_score,
        authorType: authorType,
        sentiment: sentiment
      };
      if (sentiment.bullish > 0 || sentiment.bearish > 0) {
        console.log(`[LEARNING] Sentiment at Call Time — Bullish: ${sentiment.bullish}, Bearish: ${sentiment.bearish} (window: 50 msgs)`);
      }
      const result = await processCandidateFromSignals({
        mint: ca,
        route: 'tg_alpha',
        source: 'tg_alpha',
        sourceMeta: {
          groupId,
          groupName,
          rawMessage: text.slice(0, 500),
          senderId: String(senderId),
          callerMeta,
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
      let senderUsername = 'unknown';
      try {
        const entity = await client.getEntity(msg.peerId);
        groupName = entity?.title || entity?.username || entity?.firstName || '';
        if (msg.fromId || msg.senderId) {
           const userEntity = await client.getEntity(msg.fromId || msg.senderId);
           senderUsername = userEntity?.username || userEntity?.firstName || 'unknown';
        }
      } catch { /* non-fatal */ }
      
      const lowerUser = senderUsername.toLowerCase();
      const authorType = (lowerUser.includes('phanes') || lowerUser.includes('rick')) ? 'bot' : 'human';
      
      // Update message buffer for sentiment
      if (chatId && msg.message) {
         if (!groupMessageBuffer.has(chatId)) groupMessageBuffer.set(chatId, []);
         const buf = groupMessageBuffer.get(chatId);
         buf.push(msg.message);
         if (buf.length > 50) buf.shift(); // Keep last 50
      }
      

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

      const { addresses } = parseTokenCall(msg.message);
      
      // If no CA, just return
      if (addresses.length === 0) return;
      
      // If Human caller, cache it and delay processing
      if (authorType === 'human') {
         for (const ca of addresses) {
            const cacheKey = `${chatId}:${ca}`;
            // Delay processing by 10s to see if bot replies
            const timeoutId = setTimeout(() => {
               humanCallsCache.delete(cacheKey);
               // Process as human text only
               logCallToDb(senderUsername, senderId, ca, Date.now(), null, chatId);
               processMessage({
                  text: msg.message,
                  groupId: chatId,
                  groupName,
                  senderId,
                  senderUsername,
                  timestamp: Date.now(),
                  authorType: 'human'
               });
            }, 10000);
            
            humanCallsCache.set(cacheKey, { 
               callerId: senderId, 
               callerHandle: senderUsername, 
               timestamp: Date.now(),
               timeoutId
            });
         }
      } else {
         // Bot caller: check if we have a human cache
         for (const ca of addresses) {
            const cacheKey = `${chatId}:${ca}`;
            const humanCall = humanCallsCache.get(cacheKey);
            
            if (humanCall) {
               // We have a match! Cancel human timeout
               clearTimeout(humanCall.timeoutId);
               humanCallsCache.delete(cacheKey);
               
               logCallToDb(humanCall.callerHandle, humanCall.callerId, ca, humanCall.timestamp, msg.message.slice(0, 100), chatId);
               
               // Process bot's card text, but attribute to human
               await processMessage({
                 text: msg.message, // The rich card text from bot
                 groupId: chatId,
                 groupName,
                 senderId: humanCall.callerId,
                 senderUsername: humanCall.callerHandle,
                 timestamp: Date.now(),
                 authorType: 'human' // Attributed to human
               });
            } else {
               // Bot card without human CA beforehand
               logCallToDb('unknown', 'unknown', ca, Date.now(), msg.message.slice(0, 100), chatId);
               await processMessage({
                 text: msg.message,
                 groupId: chatId,
                 groupName,
                 senderId: 'unknown',
                 senderUsername: 'unknown',
                 timestamp: Date.now(),
                 authorType: 'unknown'
               });
            }
         }
      }
    } catch (err) {
      console.error('[TG] handler error:', err.message);
    }
  }, new NewMessage({}));
}

