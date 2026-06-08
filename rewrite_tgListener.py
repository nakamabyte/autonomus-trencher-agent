import re

with open('/tmp/tgListener.js', 'r') as f:
    code = f.read()

# 1. Add humanCallsCache and message buffer at the top
imports = """import { parseTokenCall } from './tokenParser.js';
import { db } from '../db/connection.js';
import { sendTelegram } from '../telegram/send.js';
import { escapeHtml, truncate } from '../format.js';

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
"""

code = code.replace("import { escapeHtml } from '../format.js';", imports)

# 2. Add processMessage modification
# Find `async function processMessage({ text, groupId, groupName, senderId, timestamp }) {`
# And replace it with the new signature
process_old = "async function processMessage({ text, groupId, groupName, senderId, timestamp }) {"
process_new = "async function processMessage({ text, groupId, groupName, senderId, senderUsername, timestamp, authorType }) {"

code = code.replace(process_old, process_new)

# Inside processMessage, before processCandidateFromSignals:
route_old = """      const result = await processCandidateFromSignals({
        mint: ca,
        route: 'tg_alpha',
        source: 'tg_alpha',
        sourceMeta: {
          groupId,
          groupName,
          rawMessage: text.slice(0, 200),
          senderId: String(senderId),
        },
      });"""

route_new = """      const sentiment = recordGroupSentiment(groupId);
      const trust = getCallerTrust(senderUsername);
      const callerMeta = {
        callerHandle: senderUsername,
        callerId: senderId,
        trustTier: trust.tier,
        trustScore: trust.trust_score,
        authorType: authorType,
        sentiment: sentiment
      };
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
      });"""

code = code.replace(route_old, route_new)


# 3. Update the event listener
listener_old = """      // ── Resolve group name (lazily via getEntity) ──────────────────────────
      let groupName = '';
      try {
        const entity = await client.getEntity(msg.peerId);
        groupName = entity?.title || entity?.username || entity?.firstName || '';
      } catch { /* non-fatal */ }"""

listener_new = """      // ── Resolve group name (lazily via getEntity) ──────────────────────────
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
      """

code = code.replace(listener_old, listener_new)

# 4. In the listener, intercept calls to link bot to human
handler_old = """      await processMessage({
        text: msg.message,
        groupId: chatId,
        groupName,
        senderId,
        timestamp: Date.now(),
      });"""

handler_new = """      const { addresses } = parseTokenCall(msg.message);
      
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
      }"""

code = code.replace(handler_old, handler_new)

# Also remove the `const { addresses } = parseTokenCall(text); if (addresses.length === 0) return;` from processMessage since we do it before calling it, but wait, processMessage still loops over addresses!
# Let's clean up processMessage

process_mid_old = """  const { addresses } = parseTokenCall(text);
  if (addresses.length === 0) return;

  // Guard 2: per-group hourly rate limit
  if (isGroupRateLimited(groupId)) {
    console.log(`[TG] group ${groupId} rate-limited (${MAX_TRADES_PER_HOUR}/h), skip`);
    return;
  }

  for (const ca of addresses) {"""

process_mid_new = """  const { addresses } = parseTokenCall(text);
  if (addresses.length === 0) return;

  // Guard 2: per-group hourly rate limit
  if (isGroupRateLimited(groupId)) {
    console.log(`[TG] group ${groupId} rate-limited (${MAX_TRADES_PER_HOUR}/h), skip`);
    return;
  }

  for (const ca of addresses) {"""

# Wait, `processMessage` loops over `addresses` and processes them. That's fine. It's just redundant parsing, but it doesn't break anything.

with open('/tmp/tgListener2.js', 'w') as f:
    f.write(code)

