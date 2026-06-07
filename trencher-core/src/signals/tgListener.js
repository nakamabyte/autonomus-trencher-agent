/**
 * tgListener.js
 * Telegram user client that listens to curated alpha groups and routes
 * token calls into the sharedSignalFeed for Social Scout agents to consume.
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
import { sharedSignalFeed } from './sharedSignalFeed.js';
import { db } from '../db/connection.js';

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
 * Process a parsed message: extract CAs and emit to sharedSignalFeed.
 */
async function processMessage({ text, groupId, groupName, senderId, timestamp }) {
  if (!text) return;

  // Skip if group is demoted
  if (isGroupDemoted(groupId)) {
    console.log(`[TG] group ${groupId} is demoted, skipping message`);
    return;
  }

  // Track total calls for this group
  trackGroupCall(groupId, groupName);

  const { addresses } = parseTokenCall(text);
  if (addresses.length === 0) return;

  // Rate limit check (after parsing, before emitting)
  if (isGroupRateLimited(groupId)) {
    console.log(`[TG] group ${groupId} rate-limited (${MAX_TRADES_PER_HOUR}/h), skip`);
    return;
  }

  for (const ca of addresses) {
    if (isRecentDuplicate(groupId, ca)) {
      console.log(`[TG] dup skip: ${ca.slice(0, 8)} from group ${groupId}`);
      continue;
    }

    console.log(`[TG] 📡 alpha call detected: ${ca.slice(0, 8)}... from group ${groupId}`);

    // Emit to sharedSignalFeed with tg_alpha source tag
    // Social Scout agents are the only breed that consumes this (filtered in agentRunner.js)
    sharedSignalFeed.broadcast({
      mint: ca,
      symbol: null,  // unknown until enriched downstream
      source: 'tg_alpha',
      sourceMeta: {
        groupId,
        groupName,
        rawMessage: text.slice(0, 200),
        senderId: String(senderId),
      },
      priority: 'high',
      timestamp,
      // Liquidity floor will be enforced by evaluateSignalWithDna.js
      // via liquidity_sensitivity DNA + dna.liquidity_floor_usd
    });
  }
}

/**
 * Start the Telegram listener using gramjs TelegramClient (user session).
 *
 * IMPORTANT: This requires:
 *   1. Install gramjs: npm install telegram
 *   2. Generate a session string once: run the session-generator helper
 *   3. Set TG_API_ID, TG_API_HASH, TG_SESSION_STRING in .env
 *   4. Set TG_ALPHA_GROUPS to comma-separated group IDs/usernames
 *
 * @returns {Promise<void>}
 */
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

  const TARGET_GROUPS = (process.env.TG_ALPHA_GROUPS || '')
    .split(',')
    .map(g => g.trim())
    .filter(Boolean);

  if (TARGET_GROUPS.length === 0) {
    console.warn('[TG] No TG_ALPHA_GROUPS configured — TG listener disabled');
    return;
  }

  // Dynamically import gramjs to avoid breaking startup if not installed
  let TelegramClient, StringSession, NewMessage;
  try {
    const tg = await import('telegram');
    const sessions = await import('telegram/sessions/index.js');
    const events = await import('telegram/events/index.js');
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
  console.log(`[TG] listener active on ${TARGET_GROUPS.length} groups:`, TARGET_GROUPS);

  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg?.message) return;

      const chatId = String(msg.chatId || msg.peerId?.channelId || msg.peerId?.chatId || '');

      // Only process messages from configured target groups
      const isTarget = TARGET_GROUPS.some(g => chatId.includes(g) || g.includes(chatId));
      if (!isTarget) return;

      await processMessage({
        text: msg.message,
        groupId: chatId,
        groupName: '', // resolved lazily — not critical
        senderId: String(msg.fromId?.userId || msg.senderId || 'unknown'),
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('[TG] handler error:', err.message);
    }
  }, new NewMessage({}));
}
