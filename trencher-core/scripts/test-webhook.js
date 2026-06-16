import { pushHatcherWebhook } from '../src/db/hatcher.js';

async function testWebhook() {
  console.log('🚀 Testing Hatcher Webhook Push...');
  
  const mockPayload = {
    agent_id: "cce1b05d-e967-411e-900b-80a58463a19a",
    proposal_id: "test-webhook-proposal-1234",
    expires_at: Date.now() + 30000,
    unsigned_transaction: "mock_base64_tx_data_for_testing",
    blockhash_metadata: {
      blockhash: "MockBlockhash1234567890",
      lastValidBlockHeight: 123456
    },
    caps_check: {
      max_trade_bps_of_wallet: 50,
      max_daily_loss_bps: 300,
      max_open_positions: 2
    },
    route_summary: {
      input_mint: "So11111111111111111111111111111111111111112",
      output_mint: "MockTargetTokenMintAddress",
      input_amount_lamports: "100000000",
      expected_output_amount: "45000000",
      slippage_bps: 300
    },
    signal_payload: {
      lane: "social_scout",
      caller: "system_test",
      caller_trust: "High",
      confidence: 100,
      verdict: "BUY",
      reason: "Manual Webhook Test",
      signals: {
        rug_probability: 0,
        bundler_ratio: 0,
        smart_money_overlap: true,
        runner_signal: true,
        liquidity_usd: 10000
      }
    },
    dry_run: true
  };

  try {
    await pushHatcherWebhook(mockPayload);
    console.log('✅ Webhook execution finished.');
  } catch (err) {
    console.error('❌ Webhook test failed:', err);
  }
}

testWebhook();
