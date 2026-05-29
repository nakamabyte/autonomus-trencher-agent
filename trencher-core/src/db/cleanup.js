import fs from 'fs';
import { db } from './connection.js';
import { DB_PATH } from '../config.js';

export async function cleanupDatabase() {
  console.log(`[db] Checking disk space usage (old cleanup disabled)...`);

  try {
    const stat = fs.statfsSync(DB_PATH);
    const pct = (stat.blocks - stat.bavail) / stat.blocks * 100;
    
    if (pct > 83) {
      console.warn(`[db] Disk usage is ${pct.toFixed(2)}% — sending Telegram alert!`);
      const { sendTelegram } = await import('../telegram/send.js');
      await sendTelegram(
        `⚠️ <b>DATABASE DISK WARNING</b>\n\n` +
        `Disk usage is currently at <b>${pct.toFixed(2)}%</b> (Threshold: 83%).\n` +
        `Database auto-cleanup has been disabled. Please manually free up space or increase disk size.`
      );
    } else {
      console.log(`[db] Disk usage is safe at ${pct.toFixed(2)}%`);
    }
  } catch (err) {
    console.error(`[db] Disk usage check failed: ${err.message}`);
  }
}
