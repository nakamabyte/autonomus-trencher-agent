import { pushHatcherWebhook } from '../src/db/hatcher.js';

async function testWebhook() {
  console.log("🚀 Testing OUTGOING Webhook to Hatcher Labs...");
  
  const payload = {
    agent_id: process.env.HATCHER_AGENT_ID || 'cce1b05d-e967-411e-900b-80a58463a19a',
    proposal_id: 'prop_' + Date.now(),
    expires_at: Date.now() + 30000,
    unsigned_transaction: 'DUMMY_BASE64_TX',
    blockhash_metadata: {},
    caps_check: {
      max_trade_bps_of_wallet: 50,
      max_daily_loss_bps: 300,
      max_open_positions: 2
    },
    route_summary: {
      input_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      output_mint: 'So11111111111111111111111111111111111111112', // WSOL
      input_amount_lamports: '100000000',
      expected_output_amount: '0',
      slippage_bps: 300
    },
    signal_payload: {
      lane: 'test_scout',
      caller: 'system',
      caller_trust: 'High',
      confidence: 100,
      verdict: 'SELL',
      read: 'Manual test trigger',
      signals: { runner_signal: true }
    },
    dry_run: true
  };
  
  console.log("Triggering pushHatcherWebhook for a SELL action...");
  try {
    await pushHatcherWebhook(payload);
    console.log("✅ Webhook push success!");
  } catch (err) {
    console.error("❌ Webhook push failed:", err.message);
  }
  
  console.log("Waiting up to 10 seconds for the async request to complete and print logs...");
  setTimeout(() => {
    console.log("Test finished.");
    process.exit(0);
  }, 10000);
}

testWebhook();
