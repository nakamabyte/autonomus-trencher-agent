import { db } from './connection.js';

export function cleanupDatabase() {
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  const cutoffMs = Date.now() - fiveDaysMs;

  console.log(`[db] Starting database cleanup for records older than 5 days...`);

  try {
    const res1 = db.prepare('DELETE FROM signal_events WHERE at_ms < ?').run(cutoffMs);
    const res2 = db.prepare('DELETE FROM candidates WHERE created_at_ms < ?').run(cutoffMs);
    const res3 = db.prepare('DELETE FROM decision_logs WHERE at_ms < ?').run(cutoffMs);
    const res4 = db.prepare('DELETE FROM llm_decisions WHERE created_at_ms < ?').run(cutoffMs);
    const res5 = db.prepare('DELETE FROM llm_batches WHERE created_at_ms < ?').run(cutoffMs);
    const res6 = db.prepare('DELETE FROM trade_intents WHERE created_at_ms < ?').run(cutoffMs);

    console.log(`[db] Cleanup complete. Removed:`);
    console.log(`  - ${res1.changes} signal_events`);
    console.log(`  - ${res2.changes} candidates`);
    console.log(`  - ${res3.changes} decision_logs`);
    console.log(`  - ${res4.changes} llm_decisions`);
    console.log(`  - ${res5.changes} llm_batches`);
    console.log(`  - ${res6.changes} trade_intents`);
    
    // We optionally vacuum if there were significant deletions to reclaim disk space,
    // but SQLite's WAL mode usually reuses the empty pages gracefully.
    // If the database starts growing unbounded again, a scheduled VACUUM could be added here.
  } catch (err) {
    console.error(`[db] Cleanup failed: ${err.message}`);
  }
}
