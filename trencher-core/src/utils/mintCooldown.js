import { db } from '../db/connection.js';
import { MINT_COOLDOWN_MS } from '../config.js';

export function isOnCooldown(mint) {
  const row = db.prepare('SELECT cooldown_until_ms FROM mint_cooldowns WHERE mint = ?').get(mint);
  if (!row) return false;
  return Date.now() < row.cooldown_until_ms;
}

export function setCooldown(mint, exitReason = 'manual', overrideMs = null) {
  const closedAt = Date.now();
  const until = closedAt + (overrideMs !== null ? overrideMs : MINT_COOLDOWN_MS);
  db.prepare(`
    INSERT INTO mint_cooldowns (mint, closed_at_ms, exit_reason, cooldown_until_ms)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(mint) DO UPDATE SET 
      closed_at_ms = excluded.closed_at_ms,
      exit_reason = excluded.exit_reason,
      cooldown_until_ms = excluded.cooldown_until_ms
  `).run(mint, closedAt, String(exitReason), until);
  console.log(`[COOLDOWN] Set cooldown for ${mint} until ${new Date(until).toLocaleTimeString()}`);
}

export function getCooldownRemaining(mint) {
  const row = db.prepare('SELECT cooldown_until_ms FROM mint_cooldowns WHERE mint = ?').get(mint);
  if (!row) return 0;
  const remaining = row.cooldown_until_ms - Date.now();
  return Math.max(0, Math.floor(remaining / 60000));
}

export function clearCooldown(mint) {
  db.prepare('DELETE FROM mint_cooldowns WHERE mint = ?').run(mint);
  console.log(`[COOLDOWN] cleared ${mint.slice(0, 8)}...`);
}

export function activeCooldowns() {
  return db.prepare('SELECT * FROM mint_cooldowns WHERE cooldown_until_ms > ? ORDER BY cooldown_until_ms DESC').all(Date.now());
}

export function clearExpiredCooldowns() {
  const result = db.prepare('DELETE FROM mint_cooldowns WHERE cooldown_until_ms < ?').run(Date.now());
  if (result.changes > 0) {
    console.log(`[COOLDOWN] Cleared ${result.changes} expired cooldowns`);
  }
}
