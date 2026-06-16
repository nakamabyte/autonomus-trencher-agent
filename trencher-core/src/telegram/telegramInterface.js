import { bot } from './bot.js'
import { TELEGRAM_CHAT_ID } from '../config.js'
import { getDailyStats } from '../db/connection.js'
import cron from 'node-cron'

import {
  formatOpenPosition,
  formatClosePosition,
  formatTpHit,
  formatSlHit,
  formatDailySummary,
  formatCooldownSkip,
  formatScanSummary,
} from './notifications.js'

import {
  tweetOpenPosition,
  tweetClosePosition,
  tweetDailySummary
} from '../twitter/tweetBot.js'

const CHAT_ID = TELEGRAM_CHAT_ID

// Open position — send Telegram notification + tweet
export async function notifyOpenPosition(position, decision) {
  const msg = formatOpenPosition(position, decision)
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', disable_web_page_preview: true })
  await tweetOpenPosition(position, decision) // auto tweet
}

// Close position — send Telegram notification + tweet on win
export async function notifyClosePosition(position) {
  const msg = formatClosePosition(position)
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', disable_web_page_preview: true })
  await tweetClosePosition(position) // auto tweet wins only
}

// TP hit
export async function notifyTpHit(position, tpLevel) {
  const msg = formatTpHit(position, tpLevel)
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML' })
}

// SL hit
export async function notifySlHit(position) {
  const msg = formatSlHit(position)
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML' })
}

// Daily summary — fires at midnight WIB (17:00 UTC)
cron.schedule('0 17 * * *', async () => {
  const stats = getDailyStats()
  const msg = formatDailySummary(stats)
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML' })
  await tweetDailySummary(stats)
})

// ─── Hourly scan summary — fires at the top of every hour ────────────
// Sends a digest of how many signals were analyzed, bought, and skipped
// per agent during the past hour. Counters are reset after the snapshot.
cron.schedule('0 * * * *', async () => {
  try {
    // Lazy-import to avoid circular dependency at module load time
    const { snapshotAndResetScanStats } = await import('../agents/agentRunner.js');
    const stats = snapshotAndResetScanStats();

    // Skip if all agents reported zero scans (e.g. server just restarted)
    const totalAnalyzed = stats.reduce((a, s) => a + s.analyzed, 0);
    if (totalAnalyzed === 0) return;

    // Build a human-readable hour label in WIB (UTC+7)
    const now = new Date();
    const wibHour = (now.getUTCHours() + 7) % 24;
    const periodLabel = `${String(wibHour).padStart(2, '0')}:00 – ${String((wibHour + 1) % 24).padStart(2, '0')}:00 WIB`;

    const msg = formatScanSummary(stats, periodLabel);
    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    console.error('[telegramInterface] hourly scan summary error:', err.message);
  }
})

// ─── Hourly pending group approval — fires at :05 every hour ─────────
// Picks up to 5 unreviewed TG alpha groups discovered in discovery mode
// and sends each as a Telegram card with ✅ Add / ❌ Reject buttons.
// Groups that are neither confirmed nor rejected re-appear next hour.
cron.schedule('5 * * * *', async () => {
  try {
    const { db } = await import('../db/connection.js');
    const HOUR_MS = 60 * 60 * 1000;
    const cutoff  = Date.now() - HOUR_MS; // only re-notify if not sent in last hour

    const pending = db.prepare(`
      SELECT group_id, group_name, notification_count, first_seen_ms
      FROM tg_group_pending
      WHERE status = 'pending'
        AND last_notified_ms < ?
      ORDER BY first_seen_ms ASC
      LIMIT 5
    `).all(cutoff);

    if (pending.length === 0) return;

    for (const row of pending) {
      const name     = row.group_name || '(unknown name)';
      const count    = row.notification_count + 1;
      const firstSeen = new Date(row.first_seen_ms).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' });
      const repeatTag = count > 1 ? `\n⏳ <i>Reminder #${count} — awaiting your decision</i>` : '';

      const text = [
        `🔍 <b>New Alpha Group Detected</b>${repeatTag}`,
        ``,
        `📌 <b>Name:</b> ${name}`,
        `🆔 <b>ID:</b> <code>${row.group_id}</code>`,
        `🕐 <b>First seen:</b> ${firstSeen} WIB`,
        ``,
        `A token call was detected in this group but it is not yet monitored.`,
        `Do you want to add it to <b>Social Scout</b>?`,
      ].join('\n');

      await bot.sendMessage(CHAT_ID, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Add to Social Scout', callback_data: `scout_approve:${row.group_id}` },
            { text: '❌ Reject', callback_data: `scout_reject:${row.group_id}` },
          ]],
        },
      });

      // Update last_notified_ms and increment counter
      db.prepare(`
        UPDATE tg_group_pending
        SET last_notified_ms = ?, notification_count = ?
        WHERE group_id = ?
      `).run(Date.now(), count, row.group_id);
    }
  } catch (err) {
    console.error('[telegramInterface] pending group approval cron error:', err.message);
  }
})
