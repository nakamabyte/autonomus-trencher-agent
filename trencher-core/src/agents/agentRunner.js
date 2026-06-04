import { evaluateSignalWithDna } from './evaluateSignalWithDna.js';
import { executeAgentTrade } from './executeAgentTrade.js';
import { Connection, PublicKey } from '@solana/web3.js';

const activeAgents = new Map(); // agentId -> loop handle

// Helper to check balance
async function getWalletBalance(connection, walletAddress) {
  try {
    const balance = await connection.getBalance(new PublicKey(walletAddress));
    return balance / 1e9;
  } catch (err) {
    console.error(`[agentRunner] error getting balance for ${walletAddress}:`, err.message);
    return 0;
  }
}

function logAgentDecision(db, agentId, signal, decision) {
  try {
    db.prepare(`
      INSERT INTO decision_logs (
        at_ms, selected_mint, mode, action, verdict, confidence, reason,
        guardrails_json, token_json, candidate_json, batch_json, execution_json, strategy_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Date.now(),
      signal.mint,
      'live',
      'evaluate',
      decision.verdict,
      decision.confidence,
      decision.reason,
      '{}', '{}', '{}', '{}', '{}',
      agentId // Using strategy_id as agentId for now to differentiate
    );
  } catch (err) {
    console.error(`[agentRunner] failed to log decision for ${agentId}:`, err.message);
  }
}

export function startAgentTradingLoop(agentId, db, sharedSignalFeed, connection) {
  if (activeAgents.has(agentId)) {
    console.log(`[agent] ${agentId} already running`);
    return;
  }

  const agent = db.prepare('SELECT * FROM agent_dna WHERE id = ?').get(agentId);
  if (!agent || agent.execution_mode !== 'live') return;

  const dna = agent.dna_config ? JSON.parse(agent.dna_config) : {};

  console.log(`[agent] starting trading loop for ${agent.name} (${agent.breed})`);

  const handler = async (signal) => {
    // Skip if agent is no longer live
    const current = db.prepare('SELECT execution_mode, agent_wallet FROM agent_dna WHERE id = ?').get(agentId);
    if (!current || current.execution_mode !== 'live') {
      stopAgentTradingLoop(agentId, sharedSignalFeed);
      return;
    }

    if (!current.agent_wallet) {
      console.log(`[agent] ${agent.name} has no wallet, pausing`);
      return;
    }

    // Check if wallet still has enough SOL
    const balance = await getWalletBalance(connection, current.agent_wallet);
    if (balance < 0.02) {
      console.log(`[agent] ${agent.name} low balance (${balance} SOL), pausing`);
      return;
    }

    // Evaluate signal using this agent's DNA config
    const decision = await evaluateSignalWithDna(signal, dna);

    if (decision.verdict === 'BUY' && decision.confidence >= (dna.llm_min_confidence || 50) / 100) {
      await executeAgentTrade(agent, signal, decision, dna, db, balance);
    }

    // Log to per-agent consciousness feed
    logAgentDecision(db, agentId, signal, decision);
  };

  sharedSignalFeed.on('signal', handler);
  activeAgents.set(agentId, handler);
}

export function stopAgentTradingLoop(agentId, sharedSignalFeed) {
  const handler = activeAgents.get(agentId);
  if (handler) {
    sharedSignalFeed.off('signal', handler);
    activeAgents.delete(agentId);
    console.log(`[agent] stopped trading loop for ${agentId}`);
  }
}

// Restart all live agents on server start
export function resumeActiveAgents(db, sharedSignalFeed, connection) {
  // we assume agents table has status column as mentioned in the brief
  // however `connection.js` doesn't show a `status` column for `agent_dna`
  // so we just rely on execution_mode = 'live'
  try {
    const liveAgents = db.prepare(`
      SELECT id FROM agent_dna WHERE execution_mode = 'live'
    `).all();

    for (const agent of liveAgents) {
      startAgentTradingLoop(agent.id, db, sharedSignalFeed, connection);
    }
    console.log(`[agent] resumed ${liveAgents.length} live agents`);
  } catch (err) {
    console.error('[agent] Error resuming active agents:', err.message);
  }
}
