import { db } from '../db/connection.js';

export function addWallet(address, label = '', copySize = 0.1, priority = 1) {
  db.prepare(`
    INSERT INTO tracked_wallets (address, label, added_at_ms, copy_size_sol, priority)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET label = excluded.label, enabled = 1
  `).run(address, label, Date.now(), copySize, priority);
}

export function getEnabledWallets() {
  return db.prepare('SELECT * FROM tracked_wallets WHERE enabled = 1').all();
}

export function getWalletSet() {
  // Return Set for O(1) lookup during high-speed detection
  const rows = db.prepare('SELECT address FROM tracked_wallets WHERE enabled = 1').all();
  return new Set(rows.map(r => r.address));
}

export function recordCopy(address, won) {
  db.prepare(`
    UPDATE tracked_wallets
    SET total_copied = total_copied + 1,
        total_wins = total_wins + ?,
        win_rate = CAST(total_wins + ? AS REAL) / (total_copied + 1)
    WHERE address = ?
  `).run(won ? 1 : 0, won ? 1 : 0, address);
}

export function disableWallet(address) {
  db.prepare('UPDATE tracked_wallets SET enabled = 0 WHERE address = ?').run(address);
}
