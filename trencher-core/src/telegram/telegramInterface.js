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
  formatCooldownSkip
} from './notifications.js'

import {
  tweetOpenPosition,
  tweetClosePosition,
  tweetDailySummary
} from '../twitter/tweetBot.js'

const CHAT_ID = TELEGRAM_CHAT_ID

// Open position — kirim Telegram + tweet
export async function notifyOpenPosition(position, decision) {
  const msg = formatOpenPosition(position, decision)
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' })
  await tweetOpenPosition(position, decision) // auto tweet
}

// Close position — kirim Telegram + tweet kalau win
export async function notifyClosePosition(position) {
  const msg = formatClosePosition(position)
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' })
  await tweetClosePosition(position) // auto tweet wins only
}

// TP hit
export async function notifyTpHit(position, tpLevel) {
  const msg = formatTpHit(position, tpLevel)
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' })
}

// SL hit
export async function notifySlHit(position) {
  const msg = formatSlHit(position)
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' })
}

// Daily summary — auto setiap 00.00 WIB (UTC+7)
cron.schedule('0 17 * * *', async () => { // 17.00 UTC = 00.00 WIB
  const stats = getDailyStats()
  const msg = formatDailySummary(stats)
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' })
  await tweetDailySummary(stats) // auto tweet daily summary
})
