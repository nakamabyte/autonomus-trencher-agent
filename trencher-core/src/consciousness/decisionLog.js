import chalk from 'chalk';
import EventEmitter from 'events';

// ─── Stream Emitter ────────────────────────────────────────────────
// Consumed by streamServer.js to broadcast decisions to WebSocket clients
export const consciousnessStream = new EventEmitter();

// ─── Rolling History Buffer ────────────────────────────────────────
const HISTORY_SIZE = 50;
const decisionHistory = [];

export function getRecentDecisions(limit = 10) {
  return decisionHistory.slice(-limit).reverse();
}

// ─── Main Log Function ─────────────────────────────────────────────
/**
 * Log every agent decision with color-coded output and stream to WebSocket.
 *
 * @param {object} candidate  - Raw candidate object from candidates array
 * @param {object} analysis   - Enrichment data (bundler_rate, smart_money, etc.)
 * @param {'BUY'|'SKIP'|'ESCALATE'} verdict
 * @param {number} confidence - 0.0–1.0
 * @param {string} reason     - Human-readable reason for the decision
 * @param {'T1'|'T2'} tier    - Which LLM tier made the decision
 * @returns {object} entry
 */
export function logDecision(candidate, analysis, verdict, confidence, reason, tier = 'T1') {
  const timestamp = new Date().toISOString().slice(11, 19);

  const entry = {
    timestamp,
    tier,
    symbol:              candidate?.symbol || candidate?.token?.symbol || 'UNKNOWN',
    mint:                candidate?.mint   || candidate?.token?.mint   || '',
    wallets_analyzed:    analysis?.wallet_count        ?? 0,
    holder_count:        analysis?.holder_count        ?? analysis?.holders?.total ?? 0,
    bundle_wallets:      analysis?.bundler_count       ?? 0,
    rug_probability:     Math.round((analysis?.bundler_rate ?? 0) * 100),
    smart_money_overlap: analysis?.smart_money_overlap ?? analysis?.savedWalletExposure?.count ?? 0,
    runner_signal:       analysis?.runner_signal       ?? null,
    kol_signal:          analysis?.kol_signal          ?? null,
    confidence:          typeof confidence === 'number' ? confidence : 0,
    verdict,   // 'BUY' | 'SKIP' | 'ESCALATE'
    reason,
    strategy:            candidate?.signals?.strategy   ?? candidate?.strategy            ?? candidate?.route ?? null,
    entry_mcap:          analysis?.market_cap_usd       ?? analysis?.metrics?.mcap_usd ?? null,
  };

  // Print to console with color coding
  printDecision(entry);

  // Push to rolling history
  decisionHistory.push(entry);
  if (decisionHistory.length > HISTORY_SIZE) decisionHistory.shift();

  // Emit for WebSocket stream
  consciousnessStream.emit('decision', entry);

  return entry;
}

// ─── Console Printer ───────────────────────────────────────────────
function printDecision(entry) {
  const SEP = '─'.repeat(52);
  const mintShort = entry.mint ? `(${entry.mint.slice(0, 8)}...)` : '';
  const tierLabel = entry.tier === 'T2' ? chalk.magenta('[T2-Grok]') : chalk.cyan('[T1]');

  console.log(chalk.gray(`\n${SEP}`));
  console.log(
    tierLabel + ' ' +
    chalk.white.bold(`TOKEN FOUND: ${entry.symbol} `) +
    chalk.gray(mintShort)
  );
  console.log(chalk.gray(SEP));

  console.log(
    chalk.gray('Wallets analyzed:    ') +
    chalk.white(entry.wallets_analyzed)
  );
  console.log(
    chalk.gray('Holder count:        ') +
    chalk.white(entry.holder_count)
  );
  console.log(
    chalk.gray('Bundle wallets:      ') +
    (entry.bundle_wallets > 5 ? chalk.red(entry.bundle_wallets) : chalk.white(entry.bundle_wallets))
  );
  console.log(
    chalk.gray('Rug probability:     ') +
    (entry.rug_probability > 20
      ? chalk.red(`${entry.rug_probability}%`)
      : chalk.green(`${entry.rug_probability}%`))
  );
  console.log(
    chalk.gray('Smart money overlap: ') +
    (entry.smart_money_overlap > 0
      ? chalk.green(`${entry.smart_money_overlap} wallets`)
      : chalk.gray('none'))
  );
  console.log(
    chalk.gray('Runner signal:       ') +
    (entry.runner_signal ? chalk.cyan(entry.runner_signal) : chalk.gray('none'))
  );
  if (entry.kol_signal) {
    console.log(chalk.gray('KOL signal:          ') + chalk.magenta(entry.kol_signal));
  }
  console.log(
    chalk.gray('Confidence:          ') +
    chalk.white(entry.confidence.toFixed(2))
  );

  console.log();

  if (entry.verdict === 'BUY') {
    console.log(
      chalk.green.bold(`BUYING`) +
      (entry.strategy ? chalk.green(` [${entry.strategy}]`) : '') +
      (entry.entry_mcap ? chalk.green(` — $${Math.round(entry.entry_mcap / 1000)}K mcap`) : '')
    );
  } else if (entry.verdict === 'ESCALATE') {
    console.log(chalk.yellow.bold(`ESCALATING → Grok T2  (conf: ${entry.confidence.toFixed(2)})`));
    if (entry.reason) console.log(chalk.yellow(`  reason: ${entry.reason}`));
  } else {
    console.log(chalk.red.bold(`DID NOT BUY`));
    if (entry.reason) console.log(chalk.red(`  reason: ${entry.reason}`));
  }

  console.log(chalk.gray(SEP));
}
