const axios = require('axios');

const PUMPFUN_BASE_API = 'https://frontend-api.pump.fun';

async function fetchPumpfunBaseGraduated() {
  try {
    const res = await axios.get(
      `${PUMPFUN_BASE_API}/coins/latest?offset=0&limit=30&sort=creation_time&order=DESC&includeNsfw=false&chain=base`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = res.data || [];
    return data.map(token => ({
      mint: token.mint,            // on Base this is the ERC-20 address
      symbol: token.symbol,
      name: token.name,
      market_cap_usd: token.usd_market_cap,
      chain: 'base',
      source: 'pumpfun_base_graduated',
      created_timestamp: token.created_timestamp,
    }));
  } catch (error) {
    if (error.response && error.response.status === 530) {
      // Mute Cloudflare 530 errors to prevent log spam
    } else {
      console.error(`[base-graduated] Error fetching Base graduated tokens:`, error.message);
    }
    return [];
  }
}

async function fetchPumpfunBaseTrending() {
  try {
    const res = await axios.get(
      `${PUMPFUN_BASE_API}/coins/latest?sort=market_cap&order=DESC&chain=base&limit=50`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = res.data || [];
    return data.map(token => ({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      market_cap_usd: token.usd_market_cap,
      chain: 'base',
      source: 'pumpfun_base_trending',
    }));
  } catch (error) {
    if (error.response && error.response.status === 530) {
      // Mute Cloudflare 530 errors to prevent log spam
    } else {
      console.error(`[base-trending] Error fetching Base trending tokens:`, error.message);
    }
    return [];
  }
}

module.exports = { fetchPumpfunBaseGraduated, fetchPumpfunBaseTrending };
