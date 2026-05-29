// Mock implementations for missing external enrichment APIs
export async function getDevHoldingPercent(mint, creator) { return 0; }
export async function getDevSuccessCount(creator) { return 0; }
export async function getBuyCount(mint, minutes) { return 0; }
export async function getUniqueBuyers(mint, minutes) { return 0; }
export async function getBondingCurveProgress(mint) { return 0; }
export async function getBundlerRate(mint) { return 0; }
export async function getSmartMoneyOverlap(mint) { return 0; }
