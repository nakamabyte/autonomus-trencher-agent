import { evaluateSignalWithDna } from './evaluateSignalWithDna.js';
import { executeAgentTrade } from './executeAgentTrade.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { isOnCooldown, setCooldown, getCooldownRemaining } from '../utils/mintCooldown.js';

const activeAgents = new Map(); // agentId -> loop handle

// ── Per-agent scan stats counter (reset every hour by the hourly cron notifier) ──
// Structure: Map<agentId, { name, breed, mode, analyzed, buy, skip }>
const agentScanStats = new Map();

/**
 * Increment scan counters for a given agent.
 * @param {string} agentId
 * @param {string} agentName
 * @param {string} breed
 * @param {string} mode
 * @param {'buy'|'skip'} verdict
 */
function incrementScanStat(agentId, agentName, breed, mode, verdict) {
  let stat = agentScanStats.get(agentId);
  if (!stat) {
    stat = { name: agentName, breed, mode, analyzed: 0, buy: 0, skip: 0 };
    agentScanStats.set(agentId, stat);
  }
  stat.name = agentName; // keep fresh
  stat.breed = breed;
  stat.mode = mode;
  stat.analyzed++;
  if (verdict === 'buy') stat.buy++;
  else stat.skip++;
}

/**
 * Snapshot current scan stats for all agents, then reset counters.
 * Called by the hourly cron in telegramInterface.js.
 * @returns {Array<{ name, breed, mode, analyzed, buy, skip }>}
 */
export function snapshotAndResetScanStats() {
  const snapshot = [];
  for (const [, stat] of agentScanStats) {
    snapshot.push({ ...stat });
    stat.analyzed = 0;
    stat.buy = 0;
    stat.skip = 0;
  }
  return snapshot;
}

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
      '{}', '{}', JSON.stringify(signal), '{}', '{}',
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
    const current = db.prepare('SELECT * FROM agent_dna WHERE id = ?').get(agentId);
    if (!current || !['live', 'dry_run'].includes(current.execution_mode)) {
      stopAgentTradingLoop(agentId, sharedSignalFeed);
      return;
    }

    // ── Signal source routing ──────────────────────────────────────────────
    // Only social_scout agents process TG alpha signals.
    // All other breeds only process raw_scan signals.
    const signalSource = signal.source || 'raw_scan';
    if (signalSource === 'tg_alpha' && current.breed !== 'social_scout') return;
    if (signalSource !== 'tg_alpha' && current.breed === 'social_scout') return;

    if (current.execution_mode === 'live' && !current.agent_wallet) {
      console.log(`[agent] ${agent.name} has no wallet, pausing`);
      return;
    }

    // ── Per-agent mint cooldown check ──────────────────────────────────────
    if (isOnCooldown(signal.mint, agentId)) {
      const remaining = getCooldownRemaining(signal.mint, agentId);
      console.log(`[agent] ${agent.name} COOLDOWN skip ${signal.symbol || signal.mint.slice(0, 8)} — ${remaining}m left`);
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

    const isBuy = decision.verdict === 'BUY' && decision.confidence >= (dna.llm_min_confidence || 50) / 100;
    if (isBuy) {
      await executeAgentTrade(current, signal, decision, dna, db, balance);
      // Set per-agent cooldown after confirmed BUY
      setCooldown(signal.mint, 'agent_buy', null, agentId);
    }

    // Track scan stats for hourly Telegram summary
    incrementScanStat(agentId, current.name, current.breed, current.execution_mode, isBuy ? 'buy' : 'skip');

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
