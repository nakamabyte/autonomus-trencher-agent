const axios = require('axios');

const DEXSCREENER_API = 'https://api.dexscreener.com';

async function fetchDexscreenerBaseLatest() {
  try {
    // 1. Dapatkan profile token terbaru dari seluruh chain
    const profileRes = await axios.get(`${DEXSCREENER_API}/token-profiles/latest/v1`, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });
    
    if (!Array.isArray(profileRes.data)) return [];

    // 2. Filter hanya koin di jaringan Base
    const baseTokens = profileRes.data
      .filter(t => t.chainId === 'base' && t.tokenAddress)
      .map(t => t.tokenAddress);

    if (baseTokens.length === 0) return [];

    // 3. Ambil detail harga, mcap, dan nama koin dari endpoint token (maksimal 30 token per request)
    const chunk = baseTokens.slice(0, 30).join(',');
    const pairRes = await axios.get(`${DEXSCREENER_API}/latest/dex/tokens/${chunk}`, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });

    if (!pairRes.data || !Array.isArray(pairRes.data.pairs)) return [];

    // 4. DexScreener bisa mengembalikan banyak pair untuk satu token, kita ambil 1 pair utama per token
    const uniqueTokens = new Map();
    for (const pair of pairRes.data.pairs) {
      if (pair.chainId === 'base' && pair.baseToken && !uniqueTokens.has(pair.baseToken.address)) {
        uniqueTokens.set(pair.baseToken.address, {
          mint: pair.baseToken.address,
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
          market_cap_usd: Number(pair.marketCap || pair.fdv || 0),
          chain: 'base',
          source: 'dexscreener_base_latest',
          created_timestamp: pair.pairCreatedAt || Date.now(),
        });
      }
    }

    return Array.from(uniqueTokens.values());
  } catch (error) {
    console.error(`[base-dexscreener] Error fetching Base latest tokens:`, error.message);
    return [];
  }
}

module.exports = { fetchDexscreenerBaseLatest };
