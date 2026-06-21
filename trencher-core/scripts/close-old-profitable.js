import { db } from '../src/db/connection.js';
import { openPositions } from '../src/db/positions.js';
import { refreshPosition } from '../src/execution/positions.js';
import { executeLiveSell } from '../src/execution/router.js';

async function main() {
  console.log('Starting script to close profitable positions older than 2 days...');
  
  const positions = openPositions();
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const cutoffMs = Date.now() - TWO_DAYS_MS;
  
  let closedCount = 0;

  for (const position of positions) {
    if (position.opened_at_ms < cutoffMs) {
      console.log(`Checking position ${position.id} (${position.symbol}) opened at ${new Date(position.opened_at_ms).toISOString()}`);
      
      // Refresh the position to get the latest PnL without auto-exiting
      const refreshed = await refreshPosition(position, { autoExit: false });
      
      if (!refreshed) {
        console.log(`  Failed to refresh position ${position.id}. This token is likely completely rugged or dead. Force closing as DEAD...`);
        // Force close as a total loss (-100%)
        db.prepare(`UPDATE dry_run_positions SET status = 'closed', closed_at_ms = ?, exit_reason = 'FORCE_CLOSE_DEAD', pnl_percent = -100, pnl_sol = ? WHERE id = ?`)
          .run(Date.now(), -position.size_sol, position.id);
        closedCount++;
        continue;
      }
      
      // Check if it's profitable (or break even)
      if (refreshed.pnlPercent >= 0) {
        console.log(`  Position ${position.id} is > 2 days old and profitable (${refreshed.pnlPercent.toFixed(2)}%). Force closing...`);
        
        let sell = null;
        let closedAt = Date.now();
        let exitReason = 'TIME_BASED_EXIT';

        try {
          if (position.execution_mode === 'live') {
            console.log(`  Executing live sell for ${position.id}...`);
            sell = await executeLiveSell(position, exitReason);
          }
          
          // Update database
          db.prepare(`
            UPDATE dry_run_positions
            SET status = 'closed', closed_at_ms = ?, exit_price = ?, exit_mcap = ?, exit_reason = ?, pnl_percent = ?, pnl_sol = ?
            WHERE id = ?
          `).run(closedAt, refreshed.price, refreshed.mcap, exitReason, refreshed.pnlPercent, refreshed.pnlSol, position.id);
          
          db.prepare(`
            INSERT INTO dry_run_trades (position_id, mint, side, at_ms, price, mcap, size_sol, token_amount_est, reason, payload_json)
            VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?, ?)
          `).run(
            position.id, 
            position.mint, 
            closedAt, 
            refreshed.price, 
            refreshed.mcap, 
            position.size_sol, 
            position.token_amount_est, 
            exitReason, 
            JSON.stringify({ pnlPercent: refreshed.pnlPercent, pnlSol: refreshed.pnlSol, sell })
          );

          console.log(`  Successfully closed position ${position.id}.`);
          closedCount++;
        } catch (err) {
          console.error(`  Failed to close position ${position.id}:`, err.message);
          
          // Force close in DB if the error is related to no tokens or insufficient funds
          const msg = err.message.toLowerCase();
          if (msg.includes('no token amount') || msg.includes('insufficient') || msg.includes('balance is 0')) {
             console.log(`  Force closing position ${position.id} in database due to missing tokens...`);
             db.prepare(`UPDATE dry_run_positions SET status = 'closed', closed_at_ms = ?, exit_reason = 'FORCE_CLOSE_NO_TOKENS', pnl_percent = ?, pnl_sol = ? WHERE id = ?`)
               .run(Date.now(), refreshed.pnlPercent, refreshed.pnlSol, position.id);
             closedCount++;
          }
        }
      } else {
        console.log(`  Position ${position.id} is at a loss (${refreshed.pnlPercent.toFixed(2)}%). Skipping.`);
      }
    }
  }

  console.log(`Finished. Closed ${closedCount} positions.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
