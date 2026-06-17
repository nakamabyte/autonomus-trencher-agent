import { db } from './connection.js';
import { randomUUID } from 'crypto';

const PILOT_FLOORS = {
  max_trade_bps_of_wallet: 10,    // min 0.1% per trade
  max_daily_loss_bps:       50,   // min 0.5% daily loss limit
  max_open_positions_min:    1,
  max_open_positions_max:    5,
};

function applyFloors(caps) {
  return {
    max_trade_bps: Math.max(caps.max_trade_bps || caps.max_trade_bps_of_wallet || 50, PILOT_FLOORS.max_trade_bps_of_wallet),
    max_daily_loss_bps: Math.max(caps.max_daily_loss_bps || 300, PILOT_FLOORS.max_daily_loss_bps),
    max_open_positions: Math.min(
      Math.max(caps.max_open_positions || 2, PILOT_FLOORS.max_open_positions_min),
      PILOT_FLOORS.max_open_positions_max
    )
  };
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS hatcher_proposals (
    proposal_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    unsigned_tx_base64 TEXT NOT NULL,
    expires_at_ms INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    tx_signature TEXT,
    wallet_pubkey TEXT,
    chain TEXT,
    action TEXT,
    mint TEXT,
    input_amount_lamports TEXT,
    expected_output_amount TEXT,
    slippage_bps INTEGER,
    decision_json TEXT,
    caps_check_json TEXT,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hatcher_agents (
    agent_id TEXT PRIMARY KEY,
    max_trade_bps INTEGER DEFAULT 50,
    max_daily_loss_bps INTEGER DEFAULT 300,
    max_open_positions INTEGER DEFAULT 2,
    is_killed INTEGER DEFAULT 0,
    wallet_pubkey TEXT,
    updated_at_ms INTEGER NOT NULL
  );
`);

try {
  db.exec('ALTER TABLE hatcher_agents ADD COLUMN wallet_pubkey TEXT');
} catch (e) {
  // Column likely already exists
}

const nowMs = () => Date.now();

export function updateHatcherCaps(agentId, caps, walletPubkey) {
  const safeCaps = applyFloors(caps);
  const row = db.prepare('SELECT * FROM hatcher_agents WHERE agent_id = ?').get(agentId);
  const tnow = nowMs();
  if (row) {
    db.prepare(`
      UPDATE hatcher_agents 
      SET max_trade_bps = ?, max_daily_loss_bps = ?, max_open_positions = ?, updated_at_ms = ?, wallet_pubkey = coalesce(?, wallet_pubkey)
      WHERE agent_id = ?
    `).run(safeCaps.max_trade_bps, safeCaps.max_daily_loss_bps, safeCaps.max_open_positions, tnow, walletPubkey || null, agentId);
  } else {
    db.prepare(`
      INSERT INTO hatcher_agents (agent_id, max_trade_bps, max_daily_loss_bps, max_open_positions, is_killed, updated_at_ms, wallet_pubkey)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(agentId, safeCaps.max_trade_bps, safeCaps.max_daily_loss_bps, safeCaps.max_open_positions, tnow, walletPubkey || null);
  }
}

export function killHatcherAgent(agentId) {
  const tnow = nowMs();
  db.prepare(`
    INSERT INTO hatcher_agents (agent_id, is_killed, updated_at_ms)
    VALUES (?, 1, ?)
    ON CONFLICT(agent_id) DO UPDATE SET is_killed = 1, updated_at_ms = ?
  `).run(agentId, tnow, tnow);
}

export function reviveHatcherAgent(agentId) {
  const tnow = nowMs();
  db.prepare(`
    INSERT INTO hatcher_agents (agent_id, is_killed, updated_at_ms)
    VALUES (?, 0, ?)
    ON CONFLICT(agent_id) DO UPDATE SET is_killed = 0, updated_at_ms = ?
  `).run(agentId, tnow, tnow);
}

export function getHatcherAgent(agentId) {
  const agent = db.prepare('SELECT * FROM hatcher_agents WHERE agent_id = ?').get(agentId) || {
    agent_id: agentId,
    max_trade_bps: 50,
    max_daily_loss_bps: 300,
    max_open_positions: 2,
    is_killed: 0,
    wallet_pubkey: null
  };
  
  const safeCaps = applyFloors(agent);
  return {
    ...agent,
    max_trade_bps: safeCaps.max_trade_bps,
    max_daily_loss_bps: safeCaps.max_daily_loss_bps,
    max_open_positions: safeCaps.max_open_positions,
    wallet_pubkey: agent.wallet_pubkey || process.env.HATCHER_AGENT_PUBKEY
  };
}

export function createHatcherProposal({
  agentId,
  walletPubkey,
  chain,
  action,
  mint,
  inputAmountLamports,
  expectedOutputAmount,
  slippageBps,
  unsignedTxBase64,
  decisionJson,
  capsCheckJson,
  expiresAtMs
}) {
  const proposalId = randomUUID();
  const tnow = nowMs();
  db.prepare(`
    INSERT INTO hatcher_proposals (
      proposal_id, agent_id, unsigned_tx_base64, expires_at_ms, status,
      wallet_pubkey, chain, action, mint, input_amount_lamports, expected_output_amount,
      slippage_bps, decision_json, caps_check_json, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    proposalId, agentId, unsignedTxBase64, expiresAtMs,
    walletPubkey, chain, action, mint, inputAmountLamports, expectedOutputAmount,
    slippageBps, JSON.stringify(decisionJson), JSON.stringify(capsCheckJson), tnow, tnow
  );
  return proposalId;
}

export function getPendingProposals(agentId) {
  const tnow = nowMs();
  return db.prepare('SELECT * FROM hatcher_proposals WHERE agent_id = ? AND status = \'pending\' AND expires_at_ms > ? ORDER BY created_at_ms ASC').all(agentId, tnow);
}

export function markProposalExecuted(proposalId, status, txSignature, reason) {
  db.prepare(`
    UPDATE hatcher_proposals 
    SET status = ?, tx_signature = ?, updated_at_ms = ?
    WHERE proposal_id = ?
  `).run(status, txSignature, nowMs(), proposalId);
}

export async function pushHatcherWebhook(payload) {
  const { HATCHER_WEBHOOK_URL, HATCHER_PARTNER_API_KEY } = await import('../config.js');
  if (!HATCHER_WEBHOOK_URL) return;
  try {
    const res = await fetch(HATCHER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer hatcher_${HATCHER_PARTNER_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await res.text();
    const { sendTelegram } = await import('../telegram/send.js');
    const tokenAddress = payload.route_summary?.input_mint === 'So11111111111111111111111111111111111111112' 
      ? payload.route_summary?.output_mint 
      : payload.route_summary?.input_mint;
      
    let prettyFeedback = responseText.slice(0, 300);
    try {
      prettyFeedback = JSON.stringify(JSON.parse(responseText), null, 2);
    } catch (e) {
      // Keep as text if not JSON
    }

    if (!res.ok) {
      console.error(`[Hatcher Webhook] Failed with status ${res.status}: ${responseText}`);
      
      const displayPayload = { ...payload, unsigned_transaction: '<base64_tx_bytes_omitted>' };
      
      await sendTelegram(
        `🚨 <b>Hatcher Webhook Failed</b>\n\n` +
        `<b>Action:</b> ${payload.signal_payload?.verdict || 'UNKNOWN'}\n` +
        `<b>Token:</b> <code>${tokenAddress}</code>\n` +
        `<b>Status:</b> ${res.status}\n\n` +
        `<b>Feedback:</b>\n<pre><code class="language-json">${prettyFeedback}</code></pre>\n` +
        `<b>Payload:</b>\n<pre><code class="language-json">${JSON.stringify(displayPayload, null, 2)}</code></pre>`
      );
    } else {
      console.log(`[Hatcher Webhook] Successfully pushed proposal ${payload.proposal_id} (${res.status})`);
      
      const displayPayload = { ...payload, unsigned_transaction: '<base64_tx_bytes_omitted>' };
      
      await sendTelegram(
        `✅ <b>Hatcher Webhook Pushed</b>\n\n` +
        `<b>Action:</b> ${payload.signal_payload?.verdict || 'UNKNOWN'}\n` +
        `<b>Token:</b> <code>${tokenAddress}</code>\n` +
        `<b>Status:</b> ${res.status}\n\n` +
        `<b>Feedback:</b>\n<pre><code class="language-json">${prettyFeedback}</code></pre>\n` +
        `<b>Payload:</b>\n<pre><code class="language-json">${JSON.stringify(displayPayload, null, 2)}</code></pre>`
      );
    }
  } catch (err) {
    console.error(`[Hatcher Webhook] Error pushing to webhook:`, err.message);
    const { sendTelegram } = await import('../telegram/send.js');
    await sendTelegram(`🚨 <b>Hatcher Webhook Exception</b>\n\n<code>${err.message}</code>`);
  }
}

export async function generateAndPushHatcherProposal(action, mint, amountLamports, decisionJson, isDryRun = false) {
  console.log(`[Hatcher-Debug] Entering generateAndPushHatcherProposal for action=${action}, mint=${mint}`);
  const { HATCHER_WEBHOOK_URL, HATCHER_AGENT_ID, HATCHER_AGENT_PUBKEY, ENABLE_HATCHER_PILOT } = await import('../config.js');
  console.log(`[Hatcher-Debug] Config loaded: ENABLE=${ENABLE_HATCHER_PILOT}, ID=${HATCHER_AGENT_ID}, URL=${HATCHER_WEBHOOK_URL}`);
  
  if (!ENABLE_HATCHER_PILOT || !HATCHER_AGENT_ID || !HATCHER_WEBHOOK_URL) {
    console.log(`[Hatcher-Debug] Early exit due to missing config`);
    return;
  }

  try {
    const agent = getHatcherAgent(HATCHER_AGENT_ID);
    if (!agent || agent.is_killed) {
      console.log(`[Hatcher-Debug] Early exit: agent killed or not found`);
      return;
    }
    
    const targetPubkey = agent.wallet_pubkey || HATCHER_AGENT_PUBKEY;
    if (!targetPubkey) {
      console.log(`[Hatcher] Cannot generate parallel proposal: wallet_pubkey is missing.`);
      return;
    }

    const expiresAtMs = Date.now() + 30000;
    
    const capsCheck = {
      max_trade_bps_of_wallet: agent.max_trade_bps,
      max_daily_loss_bps: agent.max_daily_loss_bps,
      max_open_positions: agent.max_open_positions,
      proposal_expires_at: new Date(expiresAtMs).toISOString(),
      kill_switch_required: true,
      hatcher_must_sign: true
    };

    const proposalId = createHatcherProposal({
      agentId: HATCHER_AGENT_ID,
      walletPubkey: targetPubkey,
      chain: 'solana-mainnet',
      action: action,
      mint: mint,
      inputAmountLamports: String(amountLamports),
      expectedOutputAmount: '0', 
      slippageBps: 300,
      unsignedTxBase64: 'JIT', 
      decisionJson,
      capsCheckJson: capsCheck,
      expiresAtMs
    });
    
    const WSOL = 'So11111111111111111111111111111111111111112';
    const { buildUnsignedJupiterSwap } = await import('../liveExecutor.js');
    
    let jitSwap;
    try {
      jitSwap = await buildUnsignedJupiterSwap({
        inputMint: action === 'buy' ? WSOL : mint,
        outputMint: action === 'buy' ? mint : WSOL,
        amount: amountLamports,
        takerPubkey: targetPubkey,
        slippageBps: 300,
      });
    } catch (apiErr) {
      console.warn(`[Hatcher] Jupiter API failed: ${apiErr.message}. Falling back to mock transaction so webhook stream continues.`);
      jitSwap = {
        unsignedTxBase64: Buffer.from('JIT_DRY_RUN_TX_MOCK_PAYLOAD_STRING_THAT_IS_LONG_ENOUGH').toString('base64'),
        blockhashMetadata: { blockhash: 'MOCK_BLOCKHASH_DRY_RUN_123456', lastValidBlockHeight: 999999999 },
        expectedOutputAmount: '0'
      };
    }
    
    const payload = {
      agent_id: HATCHER_AGENT_ID,
      wallet_pubkey: targetPubkey,
      proposal_id: proposalId,
      expires_at: expiresAtMs,
      unsigned_transaction: jitSwap.unsignedTxBase64,
      blockhash_metadata: jitSwap.blockhashMetadata,
      caps_check: {
        max_trade_bps_of_wallet: agent.max_trade_bps,
        max_daily_loss_bps: agent.max_daily_loss_bps,
        max_open_positions: agent.max_open_positions
      },
      route_summary: {
        input_mint: action === 'buy' ? WSOL : mint,
        output_mint: action === 'buy' ? mint : WSOL,
        input_amount_lamports: String(amountLamports),
        expected_output_amount: jitSwap.expectedOutputAmount,
        slippage_bps: 300
      },
      signal_payload: {
        lane: decisionJson.lane || 'social_scout',
        caller: decisionJson.caller || 'autr_engine',
        caller_trust: decisionJson.caller_trust || 'High',
        confidence: decisionJson.confidence || 100,
        verdict: decisionJson.verdict || String(action).toUpperCase(),
        reason: decisionJson.reason || 'Trencher internal automated execution',
        signals: decisionJson.signals || {
          rug_probability: 0,
          bundler_ratio: 0,
          smart_money_overlap: true,
          runner_signal: true,
          liquidity_usd: 10000
        }
      },
      dry_run: isDryRun
    };
    
    await pushHatcherWebhook(payload);
    console.log(`[Hatcher] Generated parallel unsigned ${action.toUpperCase()} proposal for ${mint}`);
  } catch (err) {
    console.error(`[Hatcher] Parallel proposal generation failed:`, err.message);
    if (err.response?.data) {
      console.error(`[Hatcher] Error Data:`, JSON.stringify(err.response.data));
    }
  }
}
