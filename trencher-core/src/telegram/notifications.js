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
  const mode = position.execution_mode || position.mode || 'live';
  const strategy = position.strategy_id || position.strategy || 'sniper';
  const tx = position.entry_signature 
    ? `${position.entry_signature.slice(0, 6)}...${position.entry_signature.slice(-4)}` 
    : 'N/A';
  const token = position.mint 
    ? `${position.mint.slice(0, 6)}...${position.mint.slice(-4)}` 
    : 'N/A';

  return `
✅ Live buy executed

📍 ${position.symbol || 'UNKNOWN'} #${position.id || 'N/A'}
Token: ${token}
Status: open · Mode: ${mode} · Strategy: ${strategy}
Entry TX: ${tx}
Entry mcap: ${formatMcap(position.entry_mcap)} · High: ${formatMcap(position.high_water_mcap || position.entry_mcap)}
Size: ${formatSol(position.size_sol)} · PnL: ${(position.pnl_percent || 0).toFixed(1)}%
TP: ${position.tp_percent?.toFixed(1) || '0.0'}% · SL: ${position.sl_percent?.toFixed(1) || '0.0'}% · Trail: ${position.trailing_enabled ? position.trailing_percent?.toFixed(1) : '0.0'}%
`.trim()
}

// ─── TELEGRAM: CLOSE POSITION ─────────────────────────────────────
export function formatClosePosition(position) {
  const mode = position.execution_mode || position.mode || 'live';
  const strategy = position.strategy_id || position.strategy || 'sniper';
  const tx = position.entry_signature 
    ? `${position.entry_signature.slice(0, 6)}...${position.entry_signature.slice(-4)}` 
    : 'N/A';
  const token = position.mint 
    ? `${position.mint.slice(0, 6)}...${position.mint.slice(-4)}` 
    : 'N/A';
  const exitReason = position.exit_reason || 'MANUAL';

  return `
🏁 Live exit: ${exitReason}

📍 ${position.symbol || 'UNKNOWN'} #${position.id || 'N/A'}
Token: ${token}
Status: closed · Mode: ${mode} · Strategy: ${strategy}
Entry TX: ${tx}
Entry mcap: ${formatMcap(position.entry_mcap)} · High: ${formatMcap(position.high_water_mcap)}
Size: ${formatSol(position.size_sol)} · PnL: ${(position.pnl_percent || 0).toFixed(1)}%
TP: ${position.tp_percent?.toFixed(1) || '0.0'}% · SL: ${position.sl_percent?.toFixed(1) || '0.0'}% · Trail: ${position.trailing_enabled ? position.trailing_percent?.toFixed(1) : '0.0'}%
Exit: ${exitReason} at ${formatMcap(position.exit_mcap)} (${(position.pnl_percent || 0).toFixed(1)}%)
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
