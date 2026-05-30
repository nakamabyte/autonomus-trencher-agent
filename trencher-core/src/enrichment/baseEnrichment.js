const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex/tokens';

export async function enrichBaseToken(tokenAddress) {
  try {
    const [dexData, onchainData] = await Promise.all([
      fetchDexScreenerBase(tokenAddress),
      fetchAlchemyTokenData(tokenAddress),
    ]);

    return {
      price_usd: dexData?.priceUsd || 0,
      market_cap_usd: dexData?.marketCap || dexData?.fdv || 0,
      volume_24h: dexData?.volume?.h24 || 0,
      liquidity_usd: dexData?.liquidity?.usd || 0,
      price_change_5m: dexData?.priceChange?.m5 || 0,
      price_change_1h: dexData?.priceChange?.h1 || 0,
      holder_count: onchainData?.holderCount || 0,
      total_supply: onchainData?.totalSupply || 0,
      chain: 'base',
    };
  } catch (error) {
    console.error(`[baseEnrichment] Error enriching token ${tokenAddress}:`, error.message);
    return { chain: 'base' };
  }
}

async function fetchDexScreenerBase(tokenAddress) {
  try {
    // Note: use native fetch as we are in Node 18+ or import node-fetch/axios
    const res = await fetch(`${DEXSCREENER_BASE}/${tokenAddress}`);
    const data = await res.json();
    return data?.pairs?.[0] || null;
  } catch (error) {
    console.error(`[fetchDexScreenerBase] Error:`, error.message);
    return null;
  }
}

async function fetchAlchemyTokenData(tokenAddress) {
  if (!process.env.ALCHEMY_BASE_KEY) return null;
  const ALCHEMY_BASE = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_BASE_KEY}`;
  
  // Alchemy doesn't have a direct holder count API in the standard tier without specific endpoints,
  // but let's implement a dummy fallback for now as per instructions (holderCount etc)
  // Usually requires getAssetTransfers or Custom GraphQL.
  // We'll return dummy data for holder count as an example if it fails
  return { holderCount: 0, totalSupply: 0 };
}
