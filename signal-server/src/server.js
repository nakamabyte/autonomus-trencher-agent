require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startScraping, getSignals } = require('./scraper');
const { startFreshLaunchListener } = require('./sources/freshLaunch');
const { setupSignalPaywalls } = require('./x402/signalPaywall');
const { setupSignalApi } = require('./api/signalEndpoint');

const app = express();
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY;

app.use(cors());
app.use(express.json());

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!API_KEY) return next();
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// GET /api/signals — polled by trencher-core
app.get('/api/signals', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const minSources = parseInt(req.query.minSources) || 1;
  res.json({
    signals: getSignals(limit, minSources),
    fresh_launch: freshLaunchBuffer
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Setup x402 Paywalls
setupSignalPaywalls(app);

// Setup holder signal API endpoints
setupSignalApi(app, getSignals);

const freshLaunchBuffer = [];
const FRESH_TTL_MS = 10 * 60 * 1000; // keep fresh tokens 10 min max

startFreshLaunchListener((token) => {
  // Add to buffer with timestamp
  freshLaunchBuffer.push(token);
  console.log(`[fresh-launch] new token: ${token.symbol} (${token.mint})`);

  // Cleanup old entries
  const cutoff = Date.now() - FRESH_TTL_MS;
  while (freshLaunchBuffer.length && freshLaunchBuffer[0].created_at_ms < cutoff) {
    freshLaunchBuffer.shift();
  }
});

startScraping().then(() => {
  app.listen(PORT, () => {
    console.log(`[signal-server] listening on :${PORT}`);
  });
}).catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
