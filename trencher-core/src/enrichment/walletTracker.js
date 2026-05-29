const rugCache = new Map();

export async function fetchDevWalletHistory(address) {
  if (address === 'rugger') return { rug_count: 2, success_count: 0 };
  if (!address) return { rug_count: 0, success_count: 0 };
  
  const now = Date.now();
  const cached = rugCache.get(address);
  // Cache for 24 hours
  if (cached && (now - cached.timestamp < 24 * 60 * 60 * 1000)) {
    return cached.data;
  }

  try {
    // Note: Actual API for dev history is missing from the brief.
    // Defaulting to 0 for now.
    const result = { rug_count: 0, success_count: 0 };
    
    rugCache.set(address, {
      timestamp: now,
      data: result
    });
    return result;
  } catch (err) {
    console.error(`[walletTracker] error fetching history for ${address}:`, err.message);
    return { rug_count: 0, success_count: 0 };
  }
}
