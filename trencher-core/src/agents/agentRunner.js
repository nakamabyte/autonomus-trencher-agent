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

function logAgentDecision(db, agentId, agentName, signal, decision, mode = 'live') {
  try {
    db.prepare(`
      INSERT INTO decision_logs (
        at_ms, selected_mint, mode, action, verdict, confidence, reason,
        guardrails_json, token_json, candidate_json, batch_json, execution_json, strategy_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Date.now(),
      signal.mint,
      mode,
      'evaluate',
      decision.verdict,
      decision.confidence,
      decision.reason,
      '{}', '{}', '{}', '{}', '{}',
      agentId // Using strategy_id as agentId for now to differentiate
    );

    import('../server/wsServer.js').then(({ broadcast }) => {
      broadcast('CONSCIOUSNESS_DECISION', {
        timestamp: new Date().toISOString().slice(11, 19),
        tier: 'T1',
        symbol: signal.symbol || signal.mint.slice(0, 4),
        mint: signal.mint,
        wallets_analyzed: 0,
        holder_count: 0,
        bundle_wallets: Math.round((signal.bundler_ratio || 0) * 100),
        rug_probability: Math.round((signal.rug_probability || 0) * 100),
        smart_money_overlap: signal.smart_money_overlap || 0,
        runner_signal: signal.runner_signal || null,
        kol_signal: signal.kol_signal || null,
        confidence: decision.confidence,
        verdict: decision.verdict,
        reason: decision.reason,
        strategy: agentId, // The frontend filters by strategy, so we pass agentId here
        agent_name: agentName,
        entry_mcap: signal.mcap_usd || null,
      });
    }).catch(err => console.error('[agentRunner] error broadcasting:', err.message));
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
  if (!agent || !['live', 'dry_run'].includes(agent.execution_mode)) return;

  const dna = agent.dna_config ? JSON.parse(agent.dna_config) : {};

  console.log(`[agent] starting trading loop for ${agent.name} (${agent.breed})`);

  const handler = async (signal) => {
    // Skip if agent is no longer active
    const current = db.prepare('SELECT name, execution_mode, agent_wallet FROM agent_dna WHERE id = ?').get(agentId);
    if (!current || !['live', 'dry_run'].includes(current.execution_mode)) {
      stopAgentTradingLoop(agentId, sharedSignalFeed);
      return;
    }

    if (!current.agent_wallet) {
      console.log(`[agent] ${agent.name} has no wallet, pausing`);
      return;
    }

    // Check if wallet still has enough SOL
    let balance = 0;
    if (current.execution_mode === 'dry_run') {
      balance = 1.0; // Virtual balance for simulation
    } else {
      balance = await getWalletBalance(connection, current.agent_wallet);
      if (balance < 0.02) {
        console.log(`[agent] ${agent.name} low balance (${balance} SOL), pausing`);
        return;
      }
    }

    // Evaluate signal using this agent's DNA config
    const decision = await evaluateSignalWithDna(signal, dna);

    if (decision.verdict === 'BUY' && decision.confidence >= (dna.llm_min_confidence || 50) / 100) {
      await executeAgentTrade(agent, signal, decision, dna, db, balance);
    }

    // Log to per-agent consciousness feed
    logAgentDecision(db, agentId, current.name, signal, decision, current.execution_mode);
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
  // so we just rely on execution_mode = 'live' or 'dry_run'
  try {
    const liveAgents = db.prepare(`
      SELECT id FROM agent_dna WHERE execution_mode IN ('live', 'dry_run')
    `).all();

    for (const agent of liveAgents) {
      startAgentTradingLoop(agent.id, db, sharedSignalFeed, connection);
    }
    console.log(`[agent] resumed ${liveAgents.length} agents`);
  } catch (err) {
    console.error('[agent] Error resuming active agents:', err.message);
  }
}
