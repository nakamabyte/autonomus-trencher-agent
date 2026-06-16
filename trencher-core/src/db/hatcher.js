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
    if (!res.ok) {
      console.error(`[Hatcher Webhook] Failed with status ${res.status}: ${await res.text()}`);
    } else {
      console.log(`[Hatcher Webhook] Successfully pushed proposal ${payload.proposal_id} (${res.status})`);
    }
  } catch (err) {
    console.error(`[Hatcher Webhook] Error pushing to webhook:`, err.message);
  }
}
