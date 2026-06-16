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
  const strategy = position.agent_breed || position.strategy_id || position.strategy || 'sniper';
  const isBase = strategy === 'base_sniper' || (position.snapshot_json && JSON.parse(position.snapshot_json).candidate?.chain === 'base');

  // Detect Social Scout / TG Alpha source
  const snapshot    = position.snapshot_json ? (() => { try { return JSON.parse(position.snapshot_json); } catch { return {}; } })() : {};
  const signalRoute = snapshot?.candidate?.signals?.route || position.route || '';
  const isTgAlpha   = signalRoute === 'tg_fast_buy' || signalRoute === 'tg_alpha';
  const sourceMeta  = snapshot?.candidate?.sourceMeta || {};

  const freshTag = strategy === 'fresh_launch'
    ? '\n⚠️ FRESH LAUNCH — high risk, pre-graduation'
    : '';

  const txUrl = isBase ? `https://basescan.org/tx/${position.entry_signature}` : `https://solscan.io/tx/${position.entry_signature}`;
  const tx = position.entry_signature
    ? `<a href="${txUrl}">${position.entry_signature.slice(0, 6)}...${position.entry_signature.slice(-4)}</a>`
    : 'N/A';

  const tokenUrl = isBase ? `https://dexscreener.com/base/${position.mint}` : `https://gmgn.ai/sol/token/${position.mint}`;
  const token = position.mint
    ? `<a href="${tokenUrl}">${position.mint.slice(0, 6)}...${position.mint.slice(-4)}</a>`
    : 'N/A';

  const chainBadge = isBase ? '🔵 Base' : '🟣 Solana';
  const sizeText = isBase ? `${(position.size_sol || 0).toFixed(5)} ETH` : formatSol(position.size_sol);
  const agentTag = position.agent_name ? `\nAgent: <b>${position.agent_name}</b>` : '';

  if (isTgAlpha) {
    // ── Social Scout / TG Alpha notification ─────────────────────────
    const groupName  = sourceMeta.groupName  || sourceMeta.groupId  || 'Unknown Group';
    const callerId   = sourceMeta.senderId   ? `<code>${sourceMeta.senderId}</code>` : 'Unknown';
    const rawPreview = sourceMeta.rawMessage ? sourceMeta.rawMessage.slice(0, 120).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

    return `
⚡ <b>TG ALPHA SCOUT — ${mode === 'live' ? 'LIVE BUY' : 'DRY RUN BUY'}</b>${freshTag}${agentTag}

👥 <b>Group:</b> ${groupName}
👤 <b>Caller:</b> ${callerId}

🪙 <b>${position.symbol || 'UNKNOWN'}</b> #${position.id || 'N/A'} (${chainBadge})
Token: ${token}
Entry TX: ${tx}

📊 <b>Entry MCap:</b> ${formatMcap(position.entry_mcap)}
💰 <b>Size:</b> ${sizeText}
📐 TP: ${position.tp_percent?.toFixed(1) || '0.0'}% · SL: ${position.sl_percent?.toFixed(1) || '0.0'}% · Trail: ${position.trailing_enabled ? position.trailing_percent?.toFixed(1) : 'off'}%
${rawPreview ? `\n💬 <i>${rawPreview}${(sourceMeta.rawMessage?.length || 0) > 120 ? '…' : ''}</i>` : ''}`.trim();
  }

  return `
✅ ${mode === 'live' ? 'Live buy' : 'Dry run buy'} executed${freshTag}${agentTag}

📍 ${position.symbol || 'UNKNOWN'} #${position.id || 'N/A'} (${chainBadge})
Token: ${token}
Status: open · Mode: ${mode} · Strategy: ${strategy}
Entry TX: ${tx}
Entry mcap: ${formatMcap(position.entry_mcap)} · High: ${formatMcap(position.high_water_mcap || position.entry_mcap)}
Size: ${sizeText} · PnL: ${(position.pnl_percent || 0).toFixed(1)}%
TP: ${position.tp_percent?.toFixed(1) || '0.0'}% · SL: ${position.sl_percent?.toFixed(1) || '0.0'}% · Trail: ${position.trailing_enabled ? position.trailing_percent?.toFixed(1) : '0.0'}%
`.trim()
}

// ─── TELEGRAM: CLOSE POSITION ─────────────────────────────────────
export function formatClosePosition(position) {
  const mode = position.execution_mode || position.mode || 'live';
  const strategy = position.agent_breed || position.strategy_id || position.strategy || 'sniper';
  const isBase = strategy === 'base_sniper' || (position.snapshot_json && JSON.parse(position.snapshot_json).candidate?.chain === 'base');

  // Detect Social Scout / TG Alpha source
  const snapshot    = position.snapshot_json ? (() => { try { return JSON.parse(position.snapshot_json); } catch { return {}; } })() : {};
  const signalRoute = snapshot?.candidate?.signals?.route || position.route || '';
  const isTgAlpha   = signalRoute === 'tg_fast_buy' || signalRoute === 'tg_alpha';
  const sourceMeta  = snapshot?.candidate?.sourceMeta || {};

  const txUrl = isBase ? `https://basescan.org/tx/${position.entry_signature}` : `https://solscan.io/tx/${position.entry_signature}`;
  const tx = position.entry_signature
    ? `<a href="${txUrl}">${position.entry_signature.slice(0, 6)}...${position.entry_signature.slice(-4)}</a>`
    : 'N/A';

  const tokenUrl = isBase ? `https://dexscreener.com/base/${position.mint}` : `https://gmgn.ai/sol/token/${position.mint}`;
  const token = position.mint
    ? `<a href="${tokenUrl}">${position.mint.slice(0, 6)}...${position.mint.slice(-4)}</a>`
    : 'N/A';

  const exitReason = position.exit_reason || 'MANUAL';
  const chainBadge = isBase ? '🔵 Base' : '🟣 Solana';
  const sizeText = isBase ? `${(position.size_sol || 0).toFixed(5)} ETH` : formatSol(position.size_sol);
  const agentTag = position.agent_name ? `\nAgent: <b>${position.agent_name}</b>` : '';
  const pnl = position.pnl_percent || 0;

  if (isTgAlpha) {
    // ── Social Scout / TG Alpha close notification ────────────────────
    const groupName = sourceMeta.groupName || sourceMeta.groupId || 'Unknown Group';
    const pnlEmoji  = pnl > 0 ? '🟢' : pnl < 0 ? '🔴' : '⚪';
    const exitEmoji = exitReason === 'TP' ? '🎯 TP HIT' : exitReason === 'SL' ? '🛑 SL HIT' : exitReason === 'TRAIL' ? '📉 TRAILING' : `🏁 ${exitReason}`;

    return `
${pnlEmoji} <b>TG ALPHA SCOUT — ${exitEmoji}</b>${agentTag}

👥 <b>Group:</b> ${groupName}
🪙 <b>${position.symbol || 'UNKNOWN'}</b> #${position.id || 'N/A'} (${chainBadge})
Token: ${token}

📊 <b>Entry MCap:</b> ${formatMcap(position.entry_mcap)} → <b>Exit:</b> ${formatMcap(position.exit_mcap)}
📈 <b>High:</b> ${formatMcap(position.high_water_mcap)}
💰 <b>Size:</b> ${sizeText} · <b>PnL: ${pnl > 0 ? '+' : ''}${pnl.toFixed(1)}%</b>
Mode: ${mode === 'live' ? '🔴 LIVE' : '🧪 DRY RUN'}`.trim();
  }

  return `
🏁 ${mode === 'live' ? 'Live exit' : 'Dry run exit'}: ${exitReason}${agentTag}

📍 ${position.symbol || 'UNKNOWN'} #${position.id || 'N/A'} (${chainBadge})
Token: ${token}
Status: closed · Mode: ${mode} · Strategy: ${strategy}
Entry TX: ${tx}
Entry mcap: ${formatMcap(position.entry_mcap)} · High: ${formatMcap(position.high_water_mcap)}
Size: ${sizeText} · PnL: ${pnl.toFixed(1)}%
TP: ${position.tp_percent?.toFixed(1) || '0.0'}% · SL: ${position.sl_percent?.toFixed(1) || '0.0'}% · Trail: ${position.trailing_enabled ? position.trailing_percent?.toFixed(1) : '0.0'}%
Exit: ${exitReason} at ${formatMcap(position.exit_mcap)} (${pnl.toFixed(1)}%)
`.trim()
}


// ─── TELEGRAM: TP HIT ──────────────────────────────────────────────
export function formatTpHit(position, tpLevel) {
  return [
    `✅ <b>TP HIT</b>`,
    ``,
    `🪙 <b>${position.symbol}</b>`,
    `🎯 TP Level: ${tpLevel}%`,
    `💰 Current PnL: +${position.current_pnl_percent?.toFixed(2) || '0'}%`,
    `📐 Trailing activated`,
    `<i>Autonomous Trencher Agent</i>`,
  ].join('\n');
}

// ─── TELEGRAM: SL HIT ──────────────────────────────────────────────
export function formatSlHit(position) {
  return [
    `🛑 <b>STOP LOSS HIT</b>`,
    ``,
    `🪙 <b>${position.symbol}</b>`,
    `📉 Loss: ${position.pnl_percent?.toFixed(2) || '0'}%`,
    `⏱ Hold: ${Math.round(position.hold_minutes || 0)}m`,
    `<i>Autonomous Trencher Agent</i>`,
  ].join('\n');
}

// ─── TELEGRAM: DAILY SUMMARY ───────────────────────────────────────
export function formatDailySummary(stats) {
  const isProfit = stats.total_pnl_sol >= 0
  const pnlEmoji = isProfit ? '🟢' : '🔴'
  const pnlSign = isProfit ? '+' : ''
  const winRate = stats.total_trades > 0
    ? ((stats.wins / stats.total_trades) * 100).toFixed(1)
    : '0'

  const byStrategy = stats.by_strategy?.map(s =>
    `  ${formatStrategy(s.strategy)}: ${s.wins}W/${s.losses}L`
  ).join('\n') || '  No data'

  return [
    `📊 <b>DAILY SUMMARY</b>`,
    ``,
    `${pnlEmoji} PnL: ${pnlSign}${formatSol(stats.total_pnl_sol)}`,
    `📈 Win Rate: ${winRate}% (${stats.wins}W / ${stats.losses}L)`,
    `🔄 Total Trades: ${stats.total_trades}`,
    `🏆 Best: +${stats.best_pnl?.toFixed(2) || '0'}%`,
    `💀 Worst: ${stats.worst_pnl?.toFixed(2) || '0'}%`,
    ``,
    `🎯 By Strategy:`,
    byStrategy,
    `<i>Autonomous Trencher Agent</i>`,
  ].join('\n');
}

// ─── COOLDOWN SKIP ─────────────────────────────────────────────────
export function formatCooldownSkip(symbol, mint, remainingMinutes) {
  return [
    `⏳ <b>COOLDOWN ACTIVE</b>`,
    ``,
    `🪙 ${symbol}`,
    `<code>${mint}</code>`,
    `⏱ ${remainingMinutes}m remaining`,
  ].join('\n');
}

// ─── HOURLY SCAN SUMMARY ────────────────────────────────────────────
// stats: Array<{ name, breed, mode, analyzed, buy, skip }>
export function formatScanSummary(stats, periodLabel = 'last hour') {
  if (!stats || stats.length === 0) {
    return `📡 <b>Scan Update</b>\n\nNo active agents at the moment.`
  }

  const breedEmoji = {
    sniper:        '🎯',
    degen:         '🎰',
    bunker:        '🛡',
    whale_tracker: '🐳',
    scout:         '👁',
    social_scout:  '📡',
    drill_sergeant:'⚔️',
  }

  const modeLabel = (mode) => mode === 'dry_run' ? '🧪' : '🔴'

  const lines = stats.map(s => {
    const emoji = breedEmoji[s.breed] || '🤖'
    const mode  = modeLabel(s.mode)
    const buyTag = s.buy > 0 ? ` • <b>${s.buy} BUY 🟢</b>` : ''
    return `${emoji} ${mode} <b>${s.name}</b>\n   📊 ${s.analyzed} analyzed • ${s.skip} skipped${buyTag}`
  })

  const totalAnalyzed = stats.reduce((a, s) => a + s.analyzed, 0)
  const totalBuy      = stats.reduce((a, s) => a + s.buy, 0)

  return [
    `📡 <b>Agent Scan Update</b> — ${periodLabel}`,
    ``,
    lines.join('\n\n'),
    ``,
    `──────────────────`,
    `🔢 Total: <b>${totalAnalyzed}</b> signals analyzed, <b>${totalBuy}</b> BUY executed`,
    `<i>Autonomous Trencher Agent</i>`,
  ].join('\n')
}
