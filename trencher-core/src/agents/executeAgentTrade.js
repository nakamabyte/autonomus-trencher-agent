import { decrypt } from '../security/encryption.js';
import { executeJupiterSwapWithKey, parseKeypair } from '../liveExecutor.js';

const WSOL_MINT = 'So11111111111111111111111111111111111111112';

async function executeBuy({ mint, amountSol, wallet, walletKey, slippageBps }) {
  console.log(`[execute] Initiating real trade: ${amountSol} SOL of ${mint} using agent wallet ${wallet}`);
  
  try {
    const keypair = parseKeypair(walletKey);
    if (!keypair) {
      throw new Error('Failed to parse agent keypair from decrypted key.');
    }

    const amountLamports = Math.floor(amountSol * 1e9);

    // Swap WSOL -> Target Mint
    const result = await executeJupiterSwapWithKey(keypair, {
      inputMint: WSOL_MINT,
      outputMint: mint,
      amount: amountLamports,
      slippageBps: slippageBps || 300,
      useJito: false,
    });

    console.log(`[execute] ✅ Jupiter Swap Success! Tx: ${result.signature}`);
    return { success: true, mcap: null, signature: result.signature };
  } catch (error) {
    console.error(`[execute] ❌ Jupiter Swap Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function calculatePositionSize(balance, dna) {
  // Aggression determines position sizing
  // conservative: smaller positions, degen: bigger
  const riskFraction = 0.1 + ((dna.aggression || 50) / 100) * 0.3;  // 10% to 40%
  // Hard cap to 0.05 SOL to protect funds during initial testing!
  const cap = 0.05;
  const calculatedSize = Math.min(balance * riskFraction, balance - 0.02);  // keep 0.02 for fees
  return Math.min(calculatedSize, cap);
}

export function getAgentWalletKey(db, agentId) {
  const agent = db.prepare('SELECT encrypted_key FROM agent_dna WHERE id = ?').get(agentId);
  if (!agent || !agent.encrypted_key) return null;
  return decrypt(agent.encrypted_key);
}

function recordPosition(db, pos) {
  const info = db.prepare(`
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
  return info.lastInsertRowid;
}

// removed notifyAgentTrade

export async function executeAgentTrade(agent, signal, decision, dna, db, balance) {
  const positionSize = calculatePositionSize(balance, dna);
  if (positionSize <= 0) return;

  let walletKey = null;
  if (agent.execution_mode === 'live') {
    walletKey = getAgentWalletKey(db, agent.id);
    if (!walletKey) {
      console.error(`[agent] ${agent.name} has no valid wallet key, cannot trade live`);
      return;
    }
  }

  if (agent.execution_mode === 'dry_run') {
    // Only simulate execution
    console.log(`[agent] ${agent.name} is in dry_run mode. Simulating trade...`);
    const posId = recordPosition(db, {
      agent_dna_id: agent.id,
      mint: signal.mint,
      symbol: signal.symbol || signal.mint.slice(0, 4),
      entry_mcap: signal.mcap_usd || 0,
      size_sol: positionSize,
      tp_percent: agent.tp_percent ?? 100,
      sl_percent: agent.sl_percent ?? -20,
      trailing_enabled: agent.trailing_enabled ?? 1,
      trailing_percent: agent.trailing_percent ?? 15,
      execution_mode: 'dry_run',
      opened_at_ms: Date.now(),
      snapshot_json: '{}'
    });
    console.log(`[agent] ${agent.name} simulated BUY ${signal.symbol || signal.mint}`);
    import('../telegram/send.js').then(({ sendPositionOpen }) => sendPositionOpen(posId)).catch(() => {});
    return;
  }

  // Live execution mode!
  const result = await executeBuy({
    mint: signal.mint,
    amountSol: positionSize,
    wallet: agent.agent_wallet,
    walletKey,
    slippageBps: 300,
  });

  if (result.success) {
    // Record position with DNA exit params
    const posId = recordPosition(db, {
      agent_dna_id: agent.id,
      mint: signal.mint,
      symbol: signal.symbol || signal.mint.slice(0, 4),
      entry_mcap: signal.mcap_usd || result.mcap || 0,
      size_sol: positionSize,
      tp_percent: agent.tp_percent ?? 100,
      sl_percent: agent.sl_percent ?? -20,
      trailing_enabled: agent.trailing_enabled ?? 1,
      trailing_percent: agent.trailing_percent ?? 15,
      execution_mode: 'live',
      opened_at_ms: Date.now(),
      snapshot_json: JSON.stringify({ signature: result.signature })
    });

    console.log(`[agent] ${agent.name} LIVE BUY ${signal.symbol || signal.mint} | Sig: ${result.signature}`);
    import('../telegram/send.js').then(({ sendPositionOpen }) => sendPositionOpen(posId)).catch(() => {});
  }
}
