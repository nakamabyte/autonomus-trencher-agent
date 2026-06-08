/**
 * outcomeTracker.js
 * Tracks the performance of all CAs dropped in the Telegram group.
 * Runs periodically to evaluate CAs that are > 1h old and haven't been resolved yet.
 */
import { db } from '../db/connection.js';
import { fetchGmgnTokenInfo } from '../enrichment/gmgn.js';
import { now } from '../utils.js';

const EVALUATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function monitorCallOutcomes() {
  try {
    const cutoff = now() - EVALUATION_WINDOW_MS;
    
    // Select calls that are old enough, not yet resolved, and have a valid mcap_at_call
    const calls = db.prepare(`
      SELECT id, caller_handle, caller_id, token_ca, mcap_at_call, timestamp_ms
      FROM tg_calls
      WHERE timestamp_ms < ? 
        AND resolved_at_ms IS NULL
        AND mcap_at_call IS NOT NULL
        AND caller_handle != 'unknown'
      LIMIT 20
    `).all(cutoff);

    if (calls.length === 0) return;

    for (const call of calls) {
      try {
        const gmgn = await fetchGmgnTokenInfo(call.token_ca, true, 'solana');
        const currentMcap = gmgn?.market_cap;
        
        if (!currentMcap) {
          // Can't resolve, maybe token is dead. Mark it resolved as a LOSS or skip.
          // Let's mark it resolved to not get stuck
          db.prepare(`UPDATE tg_calls SET resolved_at_ms = ?, outcome_status = 'NO_DATA' WHERE id = ?`).run(now(), call.id);
          continue;
        }

        // Calculate performance
        const pnlPercent = ((currentMcap / call.mcap_at_call) - 1) * 100;
        const isWin = pnlPercent > 0; // Pumped!
        const outcomeStatus = isWin ? 'WIN' : 'LOSS';

        // Update call record
        db.prepare(`UPDATE tg_calls SET resolved_at_ms = ?, outcome_status = ? WHERE id = ?`).run(now(), outcomeStatus, call.id);

        // Update Caller Trust
        const caller = db.prepare(`SELECT * FROM tg_caller_trust WHERE caller_handle = ?`).get(call.caller_handle);
        if (caller) {
          let winCount = caller.win_count + (isWin ? 1 : 0);
          let lossCount = caller.loss_count + (isWin ? 0 : 1);
          let winRate = winCount / (winCount + lossCount);
          
          // Seed tier logic: A=0.8, B=0.5, C=0.3
          let seedValue = 0.5;
          if (caller.tier === 'A') seedValue = 0.8;
          if (caller.tier === 'C') seedValue = 0.3;
          if (caller.tier === 'F') seedValue = 0.0;

          // adaptive trust = 0.5*seed + 0.5*rolling_winrate
          let newTrustScore = (0.5 * seedValue) + (0.5 * winRate);

          db.prepare(`
            UPDATE tg_caller_trust 
            SET win_count = ?, loss_count = ?, trust_score = ?, updated_at_ms = ?
            WHERE caller_handle = ?
          `).run(winCount, lossCount, newTrustScore, now(), call.caller_handle);

          const lesson = `Caller ${call.caller_handle} call resulted in ${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(1)}% after 1h.`;

          console.log(`[LEARNING] Token ${call.token_ca.slice(0, 8)}... resolved (1h)
Caller:              ${call.caller_handle} (tier ${caller.tier})
Outcome:             ${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(1)}% (${outcomeStatus})
Caller trust:        ${caller.trust_score.toFixed(2)} -> ${newTrustScore.toFixed(2)} (adaptive)
Lesson:              ${lesson}`);
        }
        
      } catch (e) {
        console.error(`[OutcomeTracker] Error evaluating call ${call.id}:`, e.message);
      }
    }
  } catch (err) {
    console.error(`[OutcomeTracker] Error running monitorCallOutcomes:`, err.message);
  }
}
