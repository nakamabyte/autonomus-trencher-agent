require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startScraping, getSignals } = require('./scraper');

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
  res.json({ signals: getSignals(limit, minSources) });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

startScraping().then(() => {
  app.listen(PORT, () => {
    console.log(`[signal-server] listening on :${PORT}`);
  });
}).catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
