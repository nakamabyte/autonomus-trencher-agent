const { x402 } = require('./x402');
const { getSignals } = require('../scraper');
const fs = require('fs');
const path = require('path');

function getWalletFromEnv(key, defaultVal) {
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    if (!fs.existsSync(envPath)) return process.env[key] || defaultVal;
    
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : (process.env[key] || defaultVal);
  } catch (e) {
    return process.env[key] || defaultVal;
  }
}
const { getSignals } = require('../scraper');

function setupSignalPaywalls(app) {
  // 1. Solana Signal Paywall
  app.get('/api/signal/sol/:mint', x402({
    price: '0.01',
    currency: 'USDC',
    network: 'solana-mainnet',
    recipient: () => getWalletFromEnv('AGENT_WALLET_ADDRESS', 'DEFAULT_SOLANA_TREASURY_WALLET')
  }), (req, res) => {
    const mint = req.params.mint;
    
    // Attempt to find existing signal data for this mint
    const allSignals = getSignals(1000, 1);
    const tokenData = allSignals.find(s => s.mint === mint);
    
    if (tokenData) {
      res.json({
        success: true,
        data: tokenData
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No signals found for this mint'
      });
    }
  });

  // 2. Base Signal Paywall
  app.get('/api/signal/base/:token', x402({
    price: '0.01',
    currency: 'USDC',
    network: 'base',
    recipient: () => getWalletFromEnv('BASE_AGENT_WALLET', 'DEFAULT_BASE_TREASURY_WALLET')
  }), (req, res) => {
    const token = req.params.token;
    
    // Attempt to find existing signal data for this token
    const allSignals = getSignals(1000, 1);
    const tokenData = allSignals.find(s => s.mint === token);
    
    if (tokenData) {
      res.json({
        success: true,
        data: tokenData
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No signals found for this base token'
      });
    }
  });
}

module.exports = { setupSignalPaywalls };
