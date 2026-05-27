// ─── Trencher Agent — Notification & Tweet Formatter ───────────────

// Helper: format mcap
function formatMcap(mcap) {
  if (!mcap) return 'N/A'
  if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(2)}M`
  if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(1)}K`
  return `$${mcap}`
}

// Helper: format SOL
function formatSol(sol) {
  if (!sol) return '0 SOL'
  return `${parseFloat(sol).toFixed(4)} SOL`
}

// Helper: runner label
function formatRunnerTag(runnerSignal, runnerAccount) {
  if (!runnerSignal) return ''
  const labels = {
    SOLANA_REPLY_RUNNER: '🟣 Solana Reply Runner',
    GLOBAL_REPLY_RUNNER: '🌐 Global Reply Runner',
    TECH_NARRATIVE:      '🧠 Tech/AI Narrative',
    GITHUB_META:         '⚙️ GitHub Meta',
    CABAL:               '👥 Cabal Signal'
  }
  const label = labels[runnerSignal] || runnerSignal
  const account = runnerAccount ? ` • ${runnerAccount}` : ''
  return `\n🎯 Runner: ${label}${account}`
}

// Helper: KOL tag
function formatKolTag(kolSignal) {
  if (!kolSignal) return ''
  return `\n👁 KOL: ${kolSignal}`
}

// Helper: strategy badge
function formatStrategy(strategy) {
  const badges = {
    sniper:      '🎯 SNIPER',
    dip_buy:     '📉 DIP BUY',
    smart_money: '🧠 SMART MONEY',
    degen:       '🎰 DEGEN'
  }
  return badges[strategy] || strategy?.toUpperCase() || 'UNKNOWN'
}

// ─── TELEGRAM: OPEN POSITION ───────────────────────────────────────
export function formatOpenPosition(position, decision = {}) {
  const runnerTag = formatRunnerTag(decision.runner_signal, decision.runner_account)
  const kolTag = formatKolTag(decision.kol_signal)
  const confidence = decision.confidence
    ? `${(decision.confidence * 100).toFixed(0)}%`
    : 'N/A'

  return `
⚡ *POSITION OPENED*

🪙 *${position.symbol}*
📊 MCap: ${formatMcap(position.entry_mcap)}
💰 Size: ${formatSol(position.size_sol)}
🎯 Strategy: ${formatStrategy(position.strategy)}
🛑 SL: ${position.sl_percent}%  |  ✅ TP: ${position.tp_percent}%${position.trailing_enabled ? `\n📐 Trailing: ${position.trailing_percent}% (arm @ ${position.trailing_arm_percent}%)` : ''}${runnerTag}${kolTag}

🔗 \`${position.mint}\`

🤖 Confidence: ${confidence}
⏱ Token Age: ${position.token_age_minutes}m
─────────────────
_Autonomous Trencher Agent_
`.trim()
}

// ─── TELEGRAM: CLOSE POSITION ─────────────────────────────────────
export function formatClosePosition(position) {
  const isWin = position.pnl_percent > 0
  const pnlEmoji = isWin ? '🟢' : '🔴'
  const pnlSign = isWin ? '+' : ''
  const exitLabels = {
    SL:                '🛑 Stop Loss',
    TP:                '✅ Take Profit',
    TRAILING_TP:       '📐 Trailing TP',
    MAX_HOLD:          '⏰ Max Hold',
    FORCE_CLOSE_FUNDS: '⚠️ Force Close',
    MANUAL:            '👤 Manual Close'
  }
  const exitLabel = exitLabels[position.exit_reason] || position.exit_reason

  return `
${pnlEmoji} *POSITION CLOSED*

🪙 *${position.symbol}*
🔗 \`${position.mint}\`
${pnlSign}${position.pnl_percent.toFixed(2)}%  |  ${pnlSign}${formatSol(position.pnl_sol)}
📊 Exit MCap: ${formatMcap(position.exit_mcap)}
⏱ Hold: ${Math.round(position.hold_minutes || 0)}m
🚪 Exit: ${exitLabel}
─────────────────
_Autonomous Trencher Agent_
`.trim()
}

// ─── TELEGRAM: TP HIT ──────────────────────────────────────────────
export function formatTpHit(position, tpLevel) {
  return `
✅ *TP HIT*

🪙 *${position.symbol}*
🎯 TP Level: ${tpLevel}%
💰 Current PnL: +${position.current_pnl_percent?.toFixed(2) || '0'}%
📐 Trailing activated
─────────────────
_Autonomous Trencher Agent_
`.trim()
}

// ─── TELEGRAM: SL HIT ──────────────────────────────────────────────
export function formatSlHit(position) {
  return `
🛑 *STOP LOSS HIT*

🪙 *${position.symbol}*
📉 Loss: ${position.pnl_percent?.toFixed(2) || '0'}%
⏱ Hold: ${Math.round(position.hold_minutes || 0)}m
─────────────────
_Autonomous Trencher Agent_
`.trim()
}

// ─── TELEGRAM: DAILY SUMMARY ───────────────────────────────────────
export function formatDailySummary(stats) {
  const isProfit = stats.total_pnl_sol >= 0
  const pnlEmoji = isProfit ? '🟢' : '🔴'
  const pnlSign = isProfit ? '+' : ''
  const winRate = stats.total_trades > 0
    ? ((stats.wins / stats.total_trades) * 100).toFixed(1)
    : '0'

  return `
📊 *DAILY SUMMARY*

${pnlEmoji} PnL: ${pnlSign}${formatSol(stats.total_pnl_sol)}
📈 Win Rate: ${winRate}% (${stats.wins}W / ${stats.losses}L)
🔄 Total Trades: ${stats.total_trades}
🏆 Best: +${stats.best_pnl?.toFixed(2) || '0'}%
💀 Worst: ${stats.worst_pnl?.toFixed(2) || '0'}%

🎯 By Strategy:
${stats.by_strategy?.map(s =>
  `  ${formatStrategy(s.strategy)}: ${s.wins}W/${s.losses}L`
).join('\n') || '  No data'}
─────────────────
_Autonomous Trencher Agent_
`.trim()
}

// ─── COOLDOWN SKIP ─────────────────────────────────────────────────
export function formatCooldownSkip(symbol, mint, remainingMinutes) {
  return `
⏳ *COOLDOWN ACTIVE*

🪙 ${symbol}
\`${mint}\`
⏱ ${remainingMinutes}m remaining
`.trim()
}
