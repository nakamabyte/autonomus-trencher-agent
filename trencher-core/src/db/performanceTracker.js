import { db } from './connection.js';

// ─── Performance Recalculation ────────────────────────────────────
// Recalculates aggregated performance stats from closed positions
// and updates the Genesis agent (first agent) in agent_dna table.
// Called periodically by stateManager.js (throttled to ~60s).

/**
 * Recalculate performance stats for the Genesis agent from dry_run_positions.
 * In Phase II there's only one agent (Genesis) — future phases will
 * track agent_dna_id per position.
 */
export function recalcGenesisPerformance() {
  try {
    const genesis = db.prepare('SELECT id FROM agent_dna ORDER BY created_at_ms ASC LIMIT 1').get();
    if (!genesis) return;

    const stats = db.prepare(`
      SELECT
        COUNT(*)                                            AS total_trades,
        SUM(CASE WHEN pnl_percent > 0 THEN 1 ELSE 0 END)  AS wins,
        ROUND(SUM(pnl_sol), 6)                              AS total_pnl_sol,
        ROUND(MIN(pnl_percent), 2)                          AS max_drawdown,
        ROUND(AVG((COALESCE(closed_at_ms, 0) - opened_at_ms) / 60000.0), 2) AS avg_hold_min,
        COUNT(*)                                            AS total_exits,
        SUM(CASE WHEN exit_reason IN ('SL','FAST_EXIT_RUG','FORCE_CLOSE_FUNDS') AND pnl_percent <= -50 THEN 0 ELSE 1 END) AS survived
      FROM dry_run_positions
      WHERE status = 'closed'
    `).get();

    if (!stats || stats.total_trades === 0) return;

    const winRate = stats.total_trades > 0
      ? stats.wins / stats.total_trades
      : 0;

    const rugSurvivalRate = stats.total_exits > 0
      ? stats.survived / stats.total_exits
      : 1;

    db.prepare(`
      UPDATE agent_dna SET
        total_trades      = @total_trades,
        win_rate          = @win_rate,
        total_pnl_sol     = @total_pnl_sol,
        max_drawdown      = @max_drawdown,
        avg_hold_min      = @avg_hold_min,
        rug_survival_rate = @rug_survival_rate,
        updated_at_ms     = @updated_at_ms
      WHERE id = @id
    `).run({
      id:                genesis.id,
      total_trades:      stats.total_trades,
      win_rate:          winRate,
      total_pnl_sol:     stats.total_pnl_sol ?? 0,
      max_drawdown:      stats.max_drawdown  ?? 0,
      avg_hold_min:      stats.avg_hold_min  ?? 0,
      rug_survival_rate: rugSurvivalRate,
      updated_at_ms:     Date.now(),
    });
  } catch (err) {
    // Silently fail — DB might not be ready or table might not exist yet
    console.error('[performance-tracker] recalc failed:', err.message);
  }
}
