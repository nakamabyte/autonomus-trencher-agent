import { db } from '../src/db/connection.js';

console.log("Updating max_open_positions in local SQLite Database...");

// 1. Update Trencher's global settings
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('max_open_positions', '30')").run();
console.log('✅ Updated Trencher global max_open_positions to 30');

// 2. Update Hatcher Agent Caps
db.prepare("UPDATE hatcher_agents SET max_open_positions = 30").run();
console.log('✅ Updated Hatcher webhook payload max_open_positions caps to 30');

// 3. (Skipped: agent_dna table does not have a max_open_positions column in this version)
// db.prepare("UPDATE agent_dna SET max_open_positions = 30").run();
// console.log('✅ Updated individual agent DNA max_open_positions to 30');

console.log("\nDone! Please restart your Trencher bot for the new limits to take effect.");
