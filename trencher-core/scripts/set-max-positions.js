import { db } from '../src/db/connection.js';

console.log("Updating max_open_positions in local SQLite Database...");

// 1. Update Trencher's global settings
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('max_open_positions', '30')").run();
console.log('✅ Updated Trencher global max_open_positions to 30');

// 2. Update Hatcher Agent Caps
db.prepare("UPDATE hatcher_agents SET max_open_positions = 30").run();
console.log('✅ Updated Hatcher webhook payload max_open_positions caps to 30');

// 3. Update all active and inactive strategies (this is the one that overrides the global setting)
const rows = db.prepare('SELECT id, config_json FROM strategies').all();
let updated = 0;
for (const row of rows) {
  if (!row.config_json) continue;
  const config = JSON.parse(row.config_json);
  if (config.max_open_positions !== undefined) {
    config.max_open_positions = 30;
    db.prepare('UPDATE strategies SET config_json = ? WHERE id = ?').run(JSON.stringify(config), row.id);
    updated++;
  }
}
console.log(`✅ Updated config_json max_open_positions to 30 in ${updated} strategies`);

console.log("\nDone! Please restart your Trencher bot for the new limits to take effect.");
