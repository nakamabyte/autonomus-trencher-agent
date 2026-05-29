import { fetchDevWalletHistory } from '../enrichment/walletTracker.js';

// Serial rugger blacklist — populate from /learn analysis over time
const SERIAL_RUGGER_CACHE = new Map();

export async function passesFreshLaunchGate(token, enrichment) {
  const reasons = [];

  // RULE 1: must be very early (mcap 5k-30k window)
  const mcapUsd = enrichment.mcap_usd || 0;
  if (mcapUsd < 5000) {
    return { pass: false, reason: 'mcap below 5k floor' };
  }
  if (mcapUsd > 30000) {
    return { pass: false, reason: 'mcap above 30k — use graduated tier instead' };
  }

  // RULE 2: dev holding must be under 15%
  const devHoldingPct = enrichment.dev_holding_pct || 0;
  if (devHoldingPct > 15) {
    return { pass: false, reason: `dev holding ${devHoldingPct}% too high` };
  }

  // RULE 3: bundler rate stricter than graduated (0.10 vs 0.15)
  const bundlerRate = enrichment.bundler_rate || 0;
  if (bundlerRate > 0.10) {
    return { pass: false, reason: `bundler rate ${bundlerRate} too high for fresh` };
  }

  // RULE 4: dev wallet must not be a known serial rugger
  const devHistory = await fetchDevWalletHistory(token.creator);
  if (devHistory.rug_count >= 2) {
    return { pass: false, reason: 'dev wallet has 2+ prior rugs' };
  }

  // RULE 5 (MOST IMPORTANT): must have at least ONE strong signal
  // Fresh launches without a reason are pure noise — reject them all
  const hasRunnerSignal = !!enrichment.runner_signal;
  const hasSmartMoneyEntry = (enrichment.smart_money_overlap || 0) >= 1;
  const hasEarlyVolume = (enrichment.buy_count_5m || 0) >= 10;

  if (!hasRunnerSignal && !hasSmartMoneyEntry && !hasEarlyVolume) {
    return {
      pass: false,
      reason: 'no runner signal, no smart money, no early volume — pure noise'
    };
  }

  // Passed all gates
  return {
    pass: true,
    signals: { hasRunnerSignal, hasSmartMoneyEntry, hasEarlyVolume }
  };
}
