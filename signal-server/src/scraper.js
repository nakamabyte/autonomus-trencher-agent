const axios = require('axios');
require('dotenv').config();
const { fetchDexscreenerBaseLatest } = require('./sources/dexscreenerBase');
const { fetchDexscreenerEthLatest } = require('./sources/dexscreenerEth');
const { fetchGmgnBaseLatest } = require('./sources/gmgnBase');

// Pump.fun program addresses
const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMP_AMM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const DISC_DIST_FEES = Buffer.from('a537817004b3ca28', 'hex');

const JSON_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

// In-memory signal store: mint -> merged signal object
const signals = new Map();

// TTL config (ms)
const SIGNAL_TTL_MS = 10 * 60 * 1000;      // 10 min
const GRADUATED_POLL_MS = 30_000;
const TRENDING_POLL_MS = 60_000;

// --- Graduated coins from Pump.fun ---

async function fetchGraduated() {
  try {
    const res = await axios.get('https://advanced-api-v2.pump.fun/coins/graduated', {
      timeout: 10_000,
      headers: JSON_HEADERS,
    });
    const coins = Array.isArray(res.data?.coins) ? res.data.coins : [];
    let count = 0;
    for (const coin of coins) {
      const mint = coin?.coinMint;
      if (!mint) continue;
      upsertSignal(mint, {
        name: coin.name || '',
        symbol: coin.ticker || coin.symbol || '',
        marketCapUsd: Number(coin.marketCap || coin.mcap || 0),
        volume24h: Number(coin.volume24h || coin.volume || 0),
        graduated: {
          distanceFromAthPercent: Number(coin.distanceFromAthPercent || 0),
        },
      }, 'graduated');
      count++;
    }
    console.log(`[graduated] loaded ${count}`);
  } catch (err) {
    console.log(`[graduated] ${err.response?.status || ''} ${err.message}`);
  }
}

// --- Trending tokens from Jupiter ---
// Jupiter toptrending response: { id, symbol, name, usdPrice, mcap, liquidity, holderCount, stats5m: { buyVolume, sellVolume, numBuys, numSells } }

async function fetchTrending() {
  const apiKey = process.env.JUPITER_API_KEY;
  try {
    const url = new URL('https://api.jup.ag/tokens/v2/toptrending/5m');
    url.searchParams.set('limit', '100');
    const headers = { ...JSON_HEADERS };
    if (apiKey) headers['x-api-key'] = apiKey;
    const res = await axios.get(url.toString(), { timeout: 10_000, headers });
    const rows = Array.isArray(res.data) ? res.data : [];
    let count = 0;
    for (const row of rows) {
      const mint = row?.id || row?.mint || row?.address;
      if (!mint) continue;

      // Extract stats from nested interval object
      const stats = row?.stats5m || row?.stats1h || {};
      const buyVol = Number(stats.buyVolume ?? 0);
      const sellVol = Number(stats.sellVolume ?? 0);
      const numBuys = Number(stats.numBuys ?? 0);
      const numSells = Number(stats.numSells ?? 0);

      upsertSignal(mint, {
        name: row.name || '',
        symbol: row.symbol || '',
        priceUsd: Number(row.usdPrice ?? row.price ?? 0),
        marketCapUsd: Number(row.mcap ?? row.fdv ?? row.marketCap ?? 0),
        liquidityUsd: Number(row.liquidity ?? 0),
        holders: Number(row.holderCount ?? row.holder_count ?? 0),
        volume24h: buyVol + sellVol,
        volume5m: buyVol + sellVol,
        trending: {
          buys: numBuys,
          sells: numSells,
        },
      }, 'trending');
      count++;
    }
    console.log(`[trending] loaded ${count}`);
  } catch (err) {
    console.log(`[trending] ${err.response?.status || ''} ${err.message}`);
  }
}

// --- Fee claim detection via WebSocket ---

function readPubkey(buf, offset) {
  const { PublicKey } = require('@solana/web3.js');
  return new PublicKey(buf.subarray(offset, offset + 32)).toBase58();
}

function parseDistFees(data) {
  // Layout: 8 disc | 8 timestamp | 32 mint | 32 bondingCurve | 32 sharingConfig | 32 admin | 4 count | (32+2)*N shareholders | 8 distributed
  let offset = 8;
  offset += 8; // timestamp
  const mint = readPubkey(data, offset); offset += 32;
  offset += 32; // bondingCurve
  offset += 32; // sharingConfig
  offset += 32; // admin
  const count = data.readUInt32LE(offset); offset += 4;
  const shareholders = [];
  for (let i = 0; i < count && offset + 34 <= data.length; i++) {
    const address = readPubkey(data, offset); offset += 32;
    const bps = data.readUInt16LE(offset); offset += 2;
    shareholders.push({ address, bps });
  }
  const distributed = data.length >= offset + 8 ? data.readBigUInt64LE(offset) : 0n;
  return { mint, distributed, shareholders };
}

function startFeeClaimListener(wssUrl) {
  const WebSocket = require('ws');
  
  const urls = wssUrl.split(',').map(s => s.trim()).filter(Boolean);
  let endpointIndex = 0;
  
  let ws;
  let pingTimer;

  function connect() {
    const currentUrl = urls[endpointIndex];
    console.log(`[ws] connecting to ${currentUrl.substring(0, 50)}...`);
    ws = new WebSocket(currentUrl);

    ws.on('open', () => {
      console.log('[ws] connected');
      for (const [id, program] of [[1, PUMP_PROGRAM], [2, PUMP_AMM]]) {
        ws.send(JSON.stringify({
          jsonrpc: '2.0', id,
          method: 'logsSubscribe',
          params: [{ mentions: [program] }, { commitment: 'confirmed' }],
        }));
      }
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }, 30_000);
    });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      const value = msg.params?.result?.value;
      if (msg.method === 'logsNotification' && value) {
        processFeeLogs(value);
      }
    });

    ws.on('close', () => {
      clearInterval(pingTimer);
      endpointIndex = (endpointIndex + 1) % urls.length;
      console.log('[ws] closed, reconnecting in 5s');
      setTimeout(connect, 5000);
    });

    ws.on('error', (err) => console.log(`[ws] error: ${err.message}`));
  }

  connect();
}

function processFeeLogs(logInfo) {
  const { signature, logs, err } = logInfo;
  if (err || !logs) return;
  for (const line of logs) {
    if (!line.startsWith('Program data: ')) continue;
    let data;
    try { data = Buffer.from(line.slice('Program data: '.length), 'base64'); } catch { continue; }
    if (data.length < 8) continue;
    if (!data.subarray(0, 8).equals(DISC_DIST_FEES)) continue;
    try {
      const fee = parseDistFees(data);
      const solAmount = Number(fee.distributed) / 1e9;
      if (solAmount < 0.5) continue;
      upsertSignal(fee.mint, {
        feeClaim: {
          distributedSol: solAmount,
          signature,
          shareholders: fee.shareholders,
        },
      }, 'fee_claim');
      console.log(`[fee] ${fee.mint.slice(0, 8)}... ${solAmount.toFixed(2)} SOL`);
    } catch (e) {
      console.log(`[fee] parse error: ${e.message}`);
    }
  }
}

// --- Signal store helpers ---

function upsertSignal(mint, data, source) {
  const existing = signals.get(mint) || { mint, sources: [], sourceCount: 0, ageMs: 0, _createdAt: Date.now() };
  // Merge top-level fields
  Object.assign(existing, data, { mint });
  // Track sources
  if (!existing.sources.includes(source)) {
    existing.sources.push(source);
  }
  existing.sourceCount = existing.sources.length;
  existing.ageMs = Date.now() - existing._createdAt;
  signals.set(mint, existing);
}

function pruneStale() {
  const cutoff = Date.now() - SIGNAL_TTL_MS;
  for (const [mint, sig] of signals) {
    if (sig._createdAt < cutoff) signals.delete(mint);
  }
}

// --- Public API ---

function getSignals(limit = 100, minSources = 1) {
  pruneStale();
  const results = [];
  for (const sig of signals.values()) {
    if (sig.sourceCount >= minSources) {
      // Strip internal fields
      const { _createdAt, ...clean } = sig;
      results.push(clean);
    }
    if (results.length >= limit) break;
  }
  return results;
}

async function fetchBaseTokens() {
  const data = await fetchDexscreenerBaseLatest();
  for (const token of data) {
    upsertSignal(token.mint, {
      name: token.name,
      symbol: token.symbol,
      marketCapUsd: Number(token.market_cap_usd || 0),
      chain: 'base'
    }, token.source);
  }

  const gmgnData = await fetchGmgnBaseLatest();
  for (const token of gmgnData) {
    upsertSignal(token.mint, {
      name: token.name,
      symbol: token.symbol,
      marketCapUsd: Number(token.market_cap_usd || 0),
      chain: 'base'
    }, token.source);
  }
}

async function fetchEthTokens() {
  const data = await fetchDexscreenerEthLatest();
  for (const token of data) {
    upsertSignal(token.mint, {
      name: token.name,
      symbol: token.symbol,
      marketCapUsd: Number(token.market_cap_usd || 0),
      chain: 'ethereum'
    }, token.source);
  }
}

async function startScraping() {
  const wssUrl = process.env.SOLANA_WSS_URL;
  if (!wssUrl) {
    console.warn('[scraper] SOLANA_WSS_URL not set, fee claim listener disabled');
  } else {
    startFeeClaimListener(wssUrl);
  }

  // Initial fetch
  await Promise.allSettled([fetchGraduated(), fetchTrending(), fetchBaseTokens(), fetchEthTokens()]);

  // Polling loops
  setInterval(fetchGraduated, GRADUATED_POLL_MS);
  setInterval(fetchTrending, TRENDING_POLL_MS);
  setInterval(fetchBaseTokens, 45_000);
  setInterval(fetchEthTokens, 45_000);

  console.log(`[scraper] running — graduated every ${GRADUATED_POLL_MS / 1000}s, trending every ${TRENDING_POLL_MS / 1000}s. DexScreener Base & ETH chains enabled.`);
}

module.exports = { startScraping, getSignals };
