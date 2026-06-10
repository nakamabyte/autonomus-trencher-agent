import express from 'express';
import cors from 'cors';
import { db } from '../db/connection.js';
import { X402_PORT, X402_PRICES_USDC, X402_FREE_CALLS_PER_DAY } from '../config.js';

export function startX402Server() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // L402 Middleware
  const x402Auth = (endpointName) => {
    return (req, res, next) => {
      const authHeader = req.headers.authorization || '';
      const payerPubkey = req.headers['x-payer-pubkey'];
      const price = X402_PRICES_USDC[endpointName] || 0;

      if (!payerPubkey) {
        return res.status(400).json({ error: 'x-payer-pubkey header required' });
      }

      // Check Free Tier
      const nowMs = Date.now();
      const payerRow = db.prepare('SELECT * FROM x402_payers WHERE pubkey = ?').get(payerPubkey);
      
      let callsToday = 0;
      let lastCallMs = 0;

      if (payerRow) {
        // Reset count if it's a new day (UTC)
        const lastCallDate = new Date(payerRow.last_free_call_ms).toDateString();
        const todayDate = new Date(nowMs).toDateString();
        
        callsToday = lastCallDate === todayDate ? payerRow.free_calls_today : 0;
        lastCallMs = payerRow.last_free_call_ms;
      }

      if (callsToday < X402_FREE_CALLS_PER_DAY) {
        // Consume free call
        db.prepare(`
          INSERT INTO x402_payers (pubkey, free_calls_today, last_free_call_ms) 
          VALUES (?, ?, ?)
          ON CONFLICT(pubkey) DO UPDATE SET 
            free_calls_today = excluded.free_calls_today,
            last_free_call_ms = excluded.last_free_call_ms
        `).run(payerPubkey, callsToday + 1, nowMs);

        req.isFreeCall = true;
        return next();
      }

      // If no L402 header is provided, return 402 Payment Required
      if (!authHeader.startsWith('L402')) {
        const invoice = `mock_invoice_${Date.now()}_${price}_USDC`;
        const macaroon = `mock_macaroon_${Date.now()}`;
        
        return res.status(402)
           .set('WWW-Authenticate', `L402 macaroon="${macaroon}", invoice="${invoice}"`)
           .json({
             error: 'Payment Required',
             message: `Please pay ${price} USDC to the Treasury`,
             invoice,
             macaroon
           });
      }

      // Mock validation of payment (Facilitator)
      const isPaid = true; // In prod: verify macaroon and on-chain signature
      if (!isPaid) {
        return res.status(402).json({ error: 'Payment invalid or not settled' });
      }

      // Log Revenue
      const signature = `mock_sig_${Date.now()}`;
      db.prepare(`
        INSERT INTO x402_revenue (payer_pubkey, endpoint, amount_usdc, timestamp_ms, signature)
        VALUES (?, ?, ?, ?, ?)
      `).run(payerPubkey, endpointName, price, nowMs, signature);

      // Trigger 50/25/25 split immediately as requested
      processRevenueSplit(price, signature);

      req.isFreeCall = false;
      next();
    };
  };

  // Helper for immediate 50/25/25 split processing
  function processRevenueSplit(amount, signature) {
    try {
      const staking = (amount * 0.50).toFixed(4);
      const burn = (amount * 0.25).toFixed(4);
      const treasury = (amount * 0.25).toFixed(4);
      
      console.log(`[x402] Revenue split processed for ${amount} USDC (Sig: ${signature})`);
      console.log(`       Staking: ${staking} | Burn: ${burn} | Treasury: ${treasury}`);
      // In prod: issue actual solana SPL transfers from x402-treasury wallet
      
      // Mark as processed
      db.prepare('UPDATE x402_revenue SET split_processed = 1 WHERE signature = ?').run(signature);
    } catch (e) {
      console.error('[x402] Revenue split failed:', e.message);
    }
  }

  // --- Endpoints ---

  app.post('/v1/risk-check', x402Auth('risk-check'), (req, res) => {
    // Return read-only intelligence (no live entries)
    res.json({
      token: req.body.ca || "UNKNOWN",
      rug_probability: 0.12,
      bundler_ratio: 0.05,
      dev_hold: 0.02,
      liquidity_usd: 45000,
      note: "Data is delayed by 5 minutes to prevent front-running."
    });
  });

  app.get('/v1/market-regime', x402Auth('market-regime'), (req, res) => {
    res.json({
      status: "hot",
      graduation_rate: "12%",
      dominant_meta: "AI Agents",
      note: "Data is delayed by 5 minutes to prevent front-running."
    });
  });

  app.post('/v1/due-diligence', x402Auth('due-diligence'), (req, res) => {
    // Return deep LLM-based due diligence report (mocked for now, in prod queries agent DNA DB)
    res.json({
      token: req.body.ca || "UNKNOWN",
      verdict: "ESCALATE",
      confidence: 0.88,
      reason: "High smart money overlap and strong Kol backing detected.",
      runner_signal: "T1",
      note: "Data is delayed by 5 minutes to prevent front-running."
    });
  });

  app.get('/v1/caller-trust/:handle', x402Auth('caller-trust'), (req, res) => {
    const handle = req.params.handle;
    const callerRow = db.prepare('SELECT * FROM tg_caller_trust WHERE caller_handle = ?').get(handle);
    if (!callerRow) {
      return res.status(404).json({ error: 'Caller not found in trust database' });
    }
    res.json({
      handle: callerRow.caller_handle,
      tier: callerRow.tier,
      trust_score: callerRow.trust_score,
      win_count: callerRow.win_count,
      loss_count: callerRow.loss_count,
      note: "Data is delayed by 5 minutes to prevent front-running."
    });
  });

  app.post('/v1/sentiment-read', x402Auth('sentiment-read'), (req, res) => {
    // Return lexical sentiment analysis
    res.json({
      token: req.body.ca || "UNKNOWN",
      overall_sentiment: "BULLISH",
      lexicon_matches: ["moon", "based dev", "locked"],
      shadow_category_detected: "PUMP_HYPE",
      note: "Data is delayed by 5 minutes to prevent front-running."
    });
  });

  app.get('/v1/stats', (req, res) => {
    // Public endpoint for transparency
    const revenueRow = db.prepare('SELECT SUM(amount_usdc) as total FROM x402_revenue').get();
    const callsRow = db.prepare('SELECT COUNT(*) as total FROM x402_revenue').get();
    
    res.json({
      total_revenue_usdc: revenueRow.total || 0,
      total_paid_calls: callsRow.total || 0,
      pricing: X402_PRICES_USDC,
      free_tier_daily_limit: X402_FREE_CALLS_PER_DAY
    });
  });

  app.listen(X402_PORT, () => {
    console.log(`[x402] Signal Economy API listening on port ${X402_PORT}`);
  });
}
