import { db } from '../src/db/connection.js';

console.log('=============================================');
console.log('🟢 SCRIPT: RESTORE ALL AGENTS 🟢');
console.log('=============================================\n');

function run() {
  console.log('Memulai proses pengaktifan kembali agen-agen non-Social Scout...\n');

  const pausedAgents = db.prepare(`
    SELECT id, name, breed 
    FROM agent_dna 
    WHERE execution_mode = 'paused' AND breed != 'social_scout'
  `).all();

  console.log(`Menemukan ${pausedAgents.length} agen yang sedang dalam status 'paused'...`);

  if (pausedAgents.length > 0) {
    const resumeStmt = db.prepare(`
      UPDATE agent_dna 
      SET execution_mode = 'dry_run', updated_at_ms = ? 
      WHERE execution_mode = 'paused' AND breed != 'social_scout'
    `);
    
    resumeStmt.run(Date.now());
    
    console.log('\nDaftar agen yang berhasil diaktifkan kembali ke mode "dry_run":');
    for (const agent of pausedAgents) {
      console.log(`  - ${agent.name} (Breed: ${agent.breed})`);
    }
    
    console.log('\n✅ Semua agen non-Social Scout telah diaktifkan.');
    console.log('Catatan: Jika ada agen yang seharusnya "live", Anda perlu mengubahnya secara manual.');
  } else {
    console.log('\n✅ Tidak ada agen yang perlu diaktifkan (semua sudah aktif atau tidak ada agen yang paused).');
  }

  console.log('\n=============================================');
  console.log('✅ SELESAI.');
  console.log('=============================================');
}

try {
  run();
} catch (err) {
  console.error('❌ Terjadi kesalahan:', err.message);
}
