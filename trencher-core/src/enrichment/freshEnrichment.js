import { getDevHoldingPercent, getDevSuccessCount, getBuyCount, getUniqueBuyers, getBondingCurveProgress, getBundlerRate, getSmartMoneyOverlap } from './mockApi.js';
import { fetchDevWalletHistory as getDevRugCount } from './walletTracker.js';

export async function enrichFreshLaunch(token) {
  // NOTE: Some of these underlying fetch functions (like getDevHoldingPercent)
  // are placeholders or would need to be implemented via external APIs.
  return {
    // Dev wallet analysis
    dev_holding_pct: await getDevHoldingPercent(token.mint, token.creator).catch(() => 0),
    dev_rug_count: (await getDevRugCount(token.creator).catch(() => ({ rug_count: 0 }))).rug_count,
    dev_success_count: await getDevSuccessCount(token.creator).catch(() => 0),

    // Early activity
    buy_count_5m: await getBuyCount(token.mint, 5).catch(() => 0),
    unique_buyers_5m: await getUniqueBuyers(token.mint, 5).catch(() => 0),

    // Bonding curve progress
    bonding_curve_pct: await getBondingCurveProgress(token.mint).catch(() => 0),

    // Standard enrichment
    bundler_rate: await getBundlerRate(token.mint).catch(() => 0),
    smart_money_overlap: await getSmartMoneyOverlap(token.mint).catch(() => 0),
  };
}
