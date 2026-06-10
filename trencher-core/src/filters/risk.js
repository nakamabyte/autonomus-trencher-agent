import { db } from '../db/connection.js';
import { API_DAILY_SPEND_CAP_USDC, API_MAX_PER_CALL_USDC } from '../config.js';

/**
 * Checks if we have enough budget left today to make an API call of costUsdc.
 */
export function canSpendApiBudget(costUsdc) {
  if (costUsdc > API_MAX_PER_CALL_USDC) {
    console.warn(`[risk] KILL SWITCH TRIGGERED: Per-call API budget cap exceeded. Cost: $${costUsdc.toFixed(2)}, Max: $${API_MAX_PER_CALL_USDC}`);
    return false;
  }

  const nowMs = Date.now();
  const startOfDayMs = new Date(new Date().toDateString()).getTime();

  const result = db.prepare(`
    SELECT SUM(amount_usdc) as spentToday 
    FROM paysh_spend_log 
    WHERE timestamp_ms >= ?
  `).get(startOfDayMs);

  const spentToday = result.spentToday || 0;
  
  if (spentToday + costUsdc > API_DAILY_SPEND_CAP_USDC) {
    console.warn(`[risk] KILL SWITCH TRIGGERED: Daily API budget cap exceeded. Spent: $${spentToday.toFixed(2)}, Cap: $${API_DAILY_SPEND_CAP_USDC}`);
    return false;
  }
  return true;
}

/**
 * Records an API spend into the paysh_spend_log.
 */
export function recordApiSpend(costUsdc, provider, reason, signature) {
  try {
    db.prepare(`
      INSERT INTO paysh_spend_log (provider, amount_usdc, timestamp_ms, reason, signature)
      VALUES (?, ?, ?, ?, ?)
    `).run(provider, costUsdc, Date.now(), reason, signature);
  } catch (e) {
    console.error('[risk] Failed to record API spend:', e.message);
  }
}
