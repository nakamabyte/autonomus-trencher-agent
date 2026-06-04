import { decrypt } from '../security/encryption.js';

// Stub for executeBuy - this would normally integrate with Jupiter
async function executeBuy({ mint, amountSol, wallet, walletKey, slippageBps }) {
  console.log(`[execute] Mock buying ${amountSol} SOL of ${mint} using agent wallet ${wallet}`);
  return { success: true, price: 0.0001, mcap: 50000 }; 
}

function calculatePositionSize(balance, dna) {
  // Aggression determines position sizing
  // conservative: smaller positions, degen: bigger
  const riskFraction = 0.1 + ((dna.aggression || 50) / 100) * 0.3;  // 10% to 40%
  return Math.min(balance * riskFraction, balance - 0.02);  // keep 0.02 for fees
}

export function getAgentWalletKey(db, agentId) {
  const agent = db.prepare('SELECT encrypted_key FROM agent_dna WHERE id = ?').get(agentId);
  if (!agent || !agent.encrypted_key) return null;
  return decrypt(agent.encrypted_key);
}

function recordPosition(db, pos) {
  db.prepare(`
    INSERT INTO dry_run_positions (
      mint, symbol, status, opened_at_ms, size_sol, entry_mcap, 
      tp_percent, sl_percent, trailing_enabled, trailing_percent,
      execution_mode, agent_dna_id, snapshot_json
    ) VALUES (
      @mint, @symbol, 'open', @opened_at_ms, @size_sol, @entry_mcap,
      @tp_percent, @sl_percent, @trailing_enabled, @trailing_percent,
      @execution_mode, @agent_dna_id, @snapshot_json
    )
  `).run(pos);
}

function notifyAgentTrade(agent, signal, side) {
  console.log(`[notify] Agent ${agent.name} ${side} ${signal.symbol || signal.mint}`);
}

export async function executeAgentTrade(agent, signal, decision, dna, db, balance) {
  const positionSize = calculatePositionSize(balance, dna);
  if (positionSize <= 0) return;

  const walletKey = getAgentWalletKey(db, agent.id);
  if (!walletKey) {
    console.error(`[agent] ${agent.name} has no valid wallet key, cannot trade`);
    return;
  }

  // Execute via existing Jupiter execution engine
  const result = await executeBuy({
    mint: signal.mint,
    amountSol: positionSize,
    wallet: agent.agent_wallet,
    walletKey,
    slippageBps: 300,
  });

  if (result.success) {
    // Record position with DNA exit params
    recordPosition(db, {
      agent_dna_id: agent.id,
      mint: signal.mint,
      symbol: signal.symbol || signal.mint.slice(0, 4),
      entry_mcap: signal.mcap_usd || result.mcap,
      size_sol: positionSize,
      tp_percent: dna.tp_percent || 50,
      sl_percent: dna.sl_percent || -15,
      trailing_enabled: dna.trailing_enabled ? 1 : 0,
      trailing_percent: dna.trailing_percent || 15,
      execution_mode: 'live',
      opened_at_ms: Date.now(),
      snapshot_json: '{}'
    });

    console.log(`[agent] ${agent.name} BUY ${signal.symbol || signal.mint} at ${signal.mcap_usd || result.mcap}`);
    notifyAgentTrade(agent, signal, 'BUY');
  }
}
