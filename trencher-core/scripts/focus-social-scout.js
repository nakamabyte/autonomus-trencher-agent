import { db } from '../src/db/connection.js';

console.log('=============================================');
console.log('🛑 SCRIPT: FOCUS ON SOCIAL SCOUT ONLY 🛑');
console.log('=============================================\n');

function run() {
  console.log('Memulai proses penguncian strategi ke Social Scout...\n');

  // 1. Pause all agents that are NOT 'social_scout'
  const nonScoutAgents = db.prepare(`
    SELECT id, name, breed, execution_mode 
    FROM agent_dna 
    WHERE breed != 'social_scout' AND execution_mode != 'paused'
  `).all();

  console.log(`[1] Menemukan ${nonScoutAgents.length} agen aktif yang bukan Social Scout...`);
  
  if (nonScoutAgents.length > 0) {
    const pauseStmt = db.prepare(`
      UPDATE agent_dna 
      SET execution_mode = 'paused', updated_at_ms = ? 
      WHERE breed != 'social_scout' AND execution_mode != 'paused'
    `);
    pauseStmt.run(Date.now());
    console.log('    ✅ Semua agen non-Social Scout telah diubah menjadi "paused".');
  } else {
    console.log('    ✅ Tidak ada agen non-Social Scout yang aktif.');
  }

  // 2. Cari semua posisi OPEN dari agen-agen yang di-pause
  const openPositions = db.prepare(`
    SELECT p.id, p.mint, p.symbol, a.name as agent_name 
    FROM dry_run_positions p
    JOIN agent_dna a ON p.agent_dna_id = a.id
    WHERE p.status = 'open' AND a.breed != 'social_scout'
  `).all();

  console.log(`\n[2] Menemukan ${openPositions.length} open position milik agen yang di-pause...`);

  if (openPositions.length > 0) {
    const closePosStmt = db.prepare(`
      UPDATE dry_run_positions 
      SET status = 'closed', closed_at_ms = ?, exit_reason = 'manual_exit_focus_social_scout' 
      WHERE status = 'open' AND agent_dna_id IN (
        SELECT id FROM agent_dna WHERE breed != 'social_scout'
      )
    `);
    
    closePosStmt.run(Date.now());

    const insertTradeStmt = db.prepare(`
      INSERT INTO dry_run_trades (position_id, mint, side, at_ms, price, mcap, reason)
      VALUES (?, ?, 'sell', ?, NULL, NULL, 'manual_exit_focus_social_scout')
    `);

    db.transaction(() => {
      for (const pos of openPositions) {
        insertTradeStmt.run(pos.id, pos.mint, Date.now());
        console.log(`    - Menutup posisi #${pos.id} (${pos.symbol}) dari agen: ${pos.agent_name}`);
      }
    })();
    
    console.log('\n    ✅ Semua posisi tersebut telah berhasil di-mark sebagai "closed".');
  } else {
    console.log('    ✅ Tidak ada open position dari agen yang di-pause.');
  }

  console.log('\n=============================================');
  console.log('✅ SELESAI.');
  console.log('Silakan jalankan script ini di Railway/Production dengan command:');
  console.log('node scripts/focus-social-scout.js');
  console.log('=============================================');
}

try {
  run();
} catch (err) {
  console.error('❌ Terjadi kesalahan:', err.message);
}
