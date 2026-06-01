const axios = require('axios');
const crypto = require('crypto');

async function fetchGmgnBaseLatest() {
  const apiKey = process.env.GMGN_API_KEY;

  try {
    const url = new URL('https://openapi.gmgn.ai/v1/market/rank');
    url.searchParams.set('chain', 'base');
    url.searchParams.set('interval', '5m');
    url.searchParams.set('limit', '50');
    url.searchParams.set('timestamp', Math.floor(Date.now() / 1000).toString());
    url.searchParams.set('client_id', crypto.randomUUID());
    
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-APIKEY'] = apiKey;

    const res = await axios.get(url.toString(), { timeout: 10000, headers });
    
    let rows = res.data?.data?.rank || res.data?.data || res.data?.rank || [];
    if (!Array.isArray(rows)) {
      if (Array.isArray(res.data)) rows = res.data;
      else return [];
    }

    return rows.map((row) => {
      const mint = row?.address || row?.mint;
      if (!mint) return null;
      return {
        mint,
        symbol: row.symbol || '',
        name: row.name || '',
        market_cap_usd: Number(row.market_cap || row.mcap || row.marketCap || 0),
        chain: 'base',
        source: 'gmgn_base_latest'
      };
    }).filter(Boolean);

  } catch (error) {
    if (error.response?.status !== 403 && error.response?.status !== 429) {
      console.error(`[gmgn-base] Error fetching Base tokens:`, error.message);
    }
    return [];
  }
}

module.exports = { fetchGmgnBaseLatest };
