import { db } from '../db/connection.js';
import { MINT_COOLDOWN_MS } from '../config.js';

// Per-breed cooldown multipliers based on exit_discipline.
// High-discipline agents wait longer before re-entry (less noise re-trades).
// Degen agents can re-try sooner by design.
const AGENT_COOLDOWN_MS = {
  '__global__': MINT_COOLDOWN_MS,       // 2h default for global (orchestrator)
};

/**
 * Compute adaptive cooldown duration for an agent based on its exit_discipline DNA trait.
 * @param {string|null} agentId
 * @returns {number} cooldown duration in ms
 */
function cooldownDurationForAgent(agentId) {
  if (!agentId || agentId === '__global__') return MINT_COOLDOWN_MS;

  try {
    const agent = db.prepare('SELECT exit_discipline FROM agent_dna WHERE id = ?').get(agentId);
    if (!agent) return MINT_COOLDOWN_MS;

    const discipline = agent.exit_discipline || 50;
    if (discipline >= 80) return 4 * 60 * 60 * 1000;  // 4h — reaper, bunker, social_scout
    if (discipline >= 60) return MINT_COOLDOWN_MS;     // 2h — sniper, whale_tracker
    return 60 * 60 * 1000;                             // 1h — degen (fast re-entry by design)
  } catch {
    return MINT_COOLDOWN_MS;
  }
}

/**
 * Check if a mint is on cooldown for the given agent (or globally).
 * @param {string} mint
 * @param {string} [agentId='__global__']
 */
export function isOnCooldown(mint, agentId = '__global__') {
  const row = db.prepare(
    'SELECT cooldown_until_ms FROM mint_cooldowns WHERE mint = ? AND agent_id = ?'
  ).get(mint, agentId);
  if (!row) return false;
  return Date.now() < row.cooldown_until_ms;
}

/**
 * Set cooldown for a mint/agent pair.
 * @param {string} mint
 * @param {string} [exitReason='manual']
 * @param {number|null} [overrideMs=null]
 * @param {string} [agentId='__global__']
 */
export function setCooldown(mint, exitReason = 'manual', overrideMs = null, agentId = '__global__') {
  const closedAt = Date.now();
  const duration = overrideMs !== null ? overrideMs : cooldownDurationForAgent(agentId);
  const until = closedAt + duration;

  db.prepare(`
    INSERT INTO mint_cooldowns (mint, agent_id, closed_at_ms, exit_reason, cooldown_until_ms)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(mint, agent_id) DO UPDATE SET
      closed_at_ms = excluded.closed_at_ms,
      exit_reason = excluded.exit_reason,
      cooldown_until_ms = excluded.cooldown_until_ms
  `).run(mint, agentId, closedAt, String(exitReason), until);

  const durationH = (duration / 3600000).toFixed(1);
  console.log(`[COOLDOWN] Set ${durationH}h cooldown for ${mint.slice(0, 8)}... (agent: ${agentId}) until ${new Date(until).toLocaleTimeString()}`);
}

/**
 * Get remaining cooldown in minutes for a mint/agent pair.
 * @param {string} mint
 * @param {string} [agentId='__global__']
 */
export function getCooldownRemaining(mint, agentId = '__global__') {
  const row = db.prepare(
    'SELECT cooldown_until_ms FROM mint_cooldowns WHERE mint = ? AND agent_id = ?'
  ).get(mint, agentId);
  if (!row) return 0;
  const remaining = row.cooldown_until_ms - Date.now();
  return Math.max(0, Math.floor(remaining / 60000));
}

export function clearCooldown(mint, agentId = '__global__') {
  db.prepare('DELETE FROM mint_cooldowns WHERE mint = ? AND agent_id = ?').run(mint, agentId);
  console.log(`[COOLDOWN] cleared ${mint.slice(0, 8)}... (agent: ${agentId})`);
}

export function activeCooldowns() {
  return db.prepare(
    'SELECT * FROM mint_cooldowns WHERE cooldown_until_ms > ? ORDER BY cooldown_until_ms DESC'
  ).all(Date.now());
}

export function clearExpiredCooldowns() {
  const result = db.prepare('DELETE FROM mint_cooldowns WHERE cooldown_until_ms < ?').run(Date.now());
  if (result.changes > 0) {
    console.log(`[COOLDOWN] Cleared ${result.changes} expired cooldowns`);
  }
}

