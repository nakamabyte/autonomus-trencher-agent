const WebSocket = require('ws');

const API_KEYS = new Set(process.env.API_KEYS?.split(',').map(k => k.trim()).filter(Boolean) || []);

// Rolling history buffer for decisions
const decisionsHistory = [];
const MAX_DECISIONS = 50;

// Setup WebSocket connection to trencher-core to receive real-time decisions
let coreWs = null;
let reconnectTimer = null;

function connectToCore() {
  const wsUrl = process.env.CORE_WS_URL || 'ws://localhost:4001';
  console.log(`[signal-api] Connecting to core WebSocket at ${wsUrl}...`);

  coreWs = new WebSocket(wsUrl);

  coreWs.on('open', () => {
    console.log('[signal-api] Connected to core WebSocket');
  });

  coreWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'CONSCIOUSNESS_DECISION' && msg.payload) {
        // Prevent duplicate entries
        if (!decisionsHistory.some(d => d.mint === msg.payload.mint && d.timestamp === msg.payload.timestamp)) {
          decisionsHistory.unshift(msg.payload);
          if (decisionsHistory.length > MAX_DECISIONS) {
            decisionsHistory.pop();
          }
        }
      } else if (msg.type === 'CONSCIOUSNESS_HISTORY' && Array.isArray(msg.payload)) {
        decisionsHistory.length = 0;
        decisionsHistory.push(...msg.payload);
      }
    } catch (err) {
      // Ignore parsing errors
    }
  });

  coreWs.on('close', () => {
    console.log('[signal-api] Core WebSocket closed. Reconnecting in 5s...');
    coreWs = null;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectToCore, 5000);
  });

  coreWs.on('error', (err) => {
    console.error(`[signal-api] Core WebSocket error: ${err.message}`);
  });
}

// Start connection on load
connectToCore();

function setupSignalApi(app, getLatestSignals) {
  // Validate key helper
  const isAuthorized = (req) => {
    const key = req.headers['x-api-key'];
    if (!key) return false;
    // Allow either master API_KEY or one of the holder keys
    return key === process.env.API_KEY || API_KEYS.has(key);
  };

  // GET /api/signals — holder facing
  app.get('/api/signals', (req, res) => {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'invalid or missing API key' });
    }

    const signals = getLatestSignals();
    res.json({
      count: signals.length,
      timestamp: new Date().toISOString(),
      signals: signals.map(s => ({
        symbol: s.symbol,
        mint: s.mint,
        source: s.source,
        chain: s.chain || 'solana',
        mcap_usd: s.marketCapUsd || s.market_cap_usd || 0,
        created_at: s.created_timestamp || s._createdAt || 0,
      }))
    });
  });

  // Enriched signal (with LLM decision) — for holders with API access
  app.get('/api/signals/enriched', (req, res) => {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'invalid or missing API key' });
    }

    res.json({
      count: decisionsHistory.length,
      decisions: decisionsHistory.map(d => ({
        symbol: d.symbol,
        mint: d.mint,
        confidence: d.confidence,
        verdict: d.verdict,
        runner_signal: d.runner_signal,
        rug_probability: d.rug_probability,
        smart_money_overlap: d.smart_money_overlap,
        strategy: d.strategy,
        entry_mcap: d.entry_mcap,
        timestamp: d.timestamp,
      }))
    });
  });
}

module.exports = { setupSignalApi };
