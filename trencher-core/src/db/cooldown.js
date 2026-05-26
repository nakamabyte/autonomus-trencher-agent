import { db } from './connection.js';
import { now } from '../utils.js';
import { numSetting } from './settings.js';

/**
 * Check if a mint is currently on cooldown (recently closed position).
 * Auto-cleans expired cooldown entries.
 */
export function isMintOnCooldown(mint) {
  const cooldownMs = numSetting('cooldown_rebuy_ms', 60 * 60 * 1000);
  if (cooldownMs <= 0) return false;

  // Auto-cleanup expired entries
  db.prepare('DELETE FROM mint_cooldowns WHERE cooldown_until_ms < ?').run(now());

  const row = db.prepare('SELECT cooldown_until_ms FROM mint_cooldowns WHERE mint = ?').get(mint);
  return row ? row.cooldown_until_ms > now() : false;
}

/**
 * Set a cooldown on a mint after position close.
 * If cooldown_rebuy_ms is 0, cooldown is disabled and nothing is stored.
 */
export function setCooldown(mint, exitReason) {
  const cooldownMs = numSetting('cooldown_rebuy_ms', 60 * 60 * 1000);
  if (cooldownMs <= 0) return;

  const closedAt = now();
  const cooldownUntil = closedAt + cooldownMs;

  db.prepare(`
    INSERT INTO mint_cooldowns (mint, closed_at_ms, exit_reason, cooldown_until_ms)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(mint) DO UPDATE SET
      closed_at_ms = excluded.closed_at_ms,
      exit_reason = excluded.exit_reason,
      cooldown_until_ms = excluded.cooldown_until_ms
  `).run(mint, closedAt, exitReason, cooldownUntil);

  console.log(`[cooldown] set ${mint.slice(0, 8)}... reason=${exitReason} until=${new Date(cooldownUntil).toISOString()}`);
}

/**
 * Clear cooldown for a specific mint (manual override).
 */
export function clearCooldown(mint) {
  db.prepare('DELETE FROM mint_cooldowns WHERE mint = ?').run(mint);
  console.log(`[cooldown] cleared ${mint.slice(0, 8)}...`);
}

/**
 * Get all active cooldowns (for /cooldowns Telegram command).
 */
export function activeCooldowns() {
  return db.prepare('SELECT * FROM mint_cooldowns WHERE cooldown_until_ms > ? ORDER BY cooldown_until_ms ASC').all(now());
}
