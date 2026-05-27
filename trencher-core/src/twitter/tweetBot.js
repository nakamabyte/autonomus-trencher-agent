import { TwitterApi } from 'twitter-api-v2'
import { batchRevealSummary } from '../telegram/format.js'

// ─── Init client ───────────────────────────────────────────────────
let client = null

function getClient() {
  if (!client) {
    client = new TwitterApi({
      appKey:        process.env.TWITTER_APP_KEY,
      appSecret:     process.env.TWITTER_APP_SECRET,
      accessToken:   process.env.TWITTER_ACCESS_TOKEN,
      accessSecret:  process.env.TWITTER_ACCESS_SECRET,
    })
  }
  return client
}

// ─── Helper ────────────────────────────────────────────────────────
function formatMcap(mcap) {
  if (!mcap) return 'N/A'
  if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(2)}M`
  if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(1)}K`
  return `$${mcap}`
}

function isEnabled() {
  return process.env.TWITTER_ENABLED === 'true'
}

// ─── TWEET: OPEN POSITION ──────────────────────────────────────────
export async function tweetOpenPosition(position, decision = {}) {
  if (!isEnabled() || process.env.TWEET_ON_OPEN !== 'true') return
  
  // Only tweet high confidence positions
  const minConf = parseFloat(process.env.TWEET_MIN_CONFIDENCE || '0.78')
  if (decision.confidence < minConf) return

  try {
    const runnerLine = decision.runner_signal
      ? `Runner: ${decision.runner_signal}${decision.runner_account ? ` (${decision.runner_account})` : ''}`
      : null

    const kolLine = decision.kol_signal
      ? `KOL signal: ${decision.kol_signal}`
      : null

    const lines = [
      `⚡ POSITION OPENED`,
      ``,
      `$${position.symbol}`,
      `Token: ${position.mint}`,
      `MCap: ${formatMcap(position.entry_mcap)}`,
      `Strategy: ${position.strategy?.toUpperCase()}`,
      `Confidence: ${(decision.confidence * 100).toFixed(0)}%`,
      runnerLine,
      kolLine,
      ``,
      `🤖 Autonomous Trencher Agent`,
      `trencher-agent.vercel.app`,
      position.entry_signature ? `\n🔗 Proof: solscan.io/tx/${position.entry_signature}` : null
    ].filter(Boolean).join('\n')

    await getClient().v2.tweet(lines)
    console.log(`[TWITTER] Tweeted open position: ${position.symbol}`)
  } catch (err) {
    console.error(`[TWITTER] Failed to tweet open position:`, err.message)
  }
}

// ─── TWEET: CLOSE POSITION ─────────────────────────────────────────
export async function tweetClosePosition(position) {
  if (!isEnabled() || process.env.TWEET_ON_CLOSE !== 'true') return

  // Only tweet wins atau loss yang significant
  const isWin = position.pnl_percent > 0
  const isBigLoss = position.pnl_percent < -20
  if (!isWin && !isBigLoss) return

  try {
    const pnlSign = isWin ? '+' : ''
    const emoji = isWin ? '🟢' : '🔴'
    const exitLabels = {
      TRAILING_TP: 'Trailing TP',
      TP:          'Take Profit',
      SL:          'Stop Loss',
      MAX_HOLD:    'Max Hold',
    }
    const exitLabel = exitLabels[position.exit_reason] || position.exit_reason

    const lines = [
      `${emoji} POSITION CLOSED`,
      ``,
      `$${position.symbol}`,
      `Token: ${position.mint}`,
      `PnL: ${pnlSign}${position.pnl_percent.toFixed(2)}%`,
      `Hold: ${Math.round(position.hold_minutes || 0)}m`,
      `Exit: ${exitLabel}`,
      ``,
      `🤖 Autonomous Trencher Agent`,
      `trencher-agent.vercel.app`,
      position.exit_signature ? `\n🔗 Proof: solscan.io/tx/${position.exit_signature}` : null
    ].filter(Boolean).join('\n')

    await getClient().v2.tweet(lines)
    console.log(`[TWITTER] Tweeted close position: ${position.symbol} ${pnlSign}${position.pnl_percent.toFixed(2)}%`)
  } catch (err) {
    console.error(`[TWITTER] Failed to tweet close position:`, err.message)
  }
}

// ─── TWEET: DAILY SUMMARY ──────────────────────────────────────────
export async function tweetDailySummary(stats) {
  if (!isEnabled() || process.env.TWEET_ON_DAILY_SUMMARY !== 'true') return

  try {
    const isProfit = stats.total_pnl_sol >= 0
    const pnlSign = isProfit ? '+' : ''
    const emoji = isProfit ? '🟢' : '🔴'
    const winRate = stats.total_trades > 0
      ? ((stats.wins / stats.total_trades) * 100).toFixed(1)
      : '0'

    const lines = [
      `📊 DAILY SUMMARY`,
      ``,
      `${emoji} PnL: ${pnlSign}${parseFloat(stats.total_pnl_sol).toFixed(4)} SOL`,
      `Win Rate: ${winRate}% (${stats.wins}W/${stats.losses}L)`,
      `Trades: ${stats.total_trades}`,
      `Best: +${stats.best_pnl?.toFixed(2) || '0'}%`,
      ``,
      `🤖 Autonomous Trencher Agent`,
      `trencher-agent.vercel.app`,
    ].join('\n')

    await getClient().v2.tweet(lines)
    console.log(`[TWITTER] Tweeted daily summary`)
  } catch (err) {
    console.error(`[TWITTER] Failed to tweet daily summary:`, err.message)
  }
}

// ─── TWEET: BATCH REVEAL ───────────────────────────────────────────
export async function tweetBatchReveal(batchId, rows, decision, triggerCandidateId) {
  if (!isEnabled() || process.env.TWEET_ON_SCREENING !== 'true') return

  try {
    // Generate the summary using the same formatter as Telegram
    let text = batchRevealSummary(batchId, rows, decision, triggerCandidateId)
    
    // Strip HTML tags for Twitter
    text = text.replace(/<[^>]*>?/gm, '')
    
    // Append footer
    text += '\n\n🤖 Autonomous Trencher Agent\ntrencher-agent.vercel.app'

    await getClient().v2.tweet(text)
    console.log(`[TWITTER] Tweeted batch screening: #${batchId}`)
  } catch (err) {
    console.error(`[TWITTER] Failed to tweet batch screening:`, err.message)
  }
}
