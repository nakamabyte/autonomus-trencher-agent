import { db } from '../src/db/connection.js';

function insertManualBurn() {
  const stmt = db.prepare(`
    INSERT INTO burn_log (sol_spent, autr_bought, autr_burned, tx_hash_swap, tx_hash_burn, source, created_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    0.102678691, // sol_spent
    4580256,     // autr_bought
    4580256,     // autr_burned
    '5o3urAtY6iFZEw5fDYJcezWDKLKwmdW31bGQ5AkkgiXae3aEnNXJvQ1Yg8fLCw4V6KPgEgq46Yav66r6wLqZnkK',
    '5K5da5KF53QYJ2VS5DyfywCBPgy74QdKR8mkXi3HEGEAW3cTjYrGatxwvNH621ysVtsfNA4E9mAGK3bjifCpUxnL',
    'deploy',
    Date.now()
  );

  console.log('Manual burn log inserted successfully!');
}

insertManualBurn();
