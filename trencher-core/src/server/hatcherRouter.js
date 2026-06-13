import express from 'express';
import { HATCHER_PARTNER_API_KEY, ENABLE_HATCHER_PILOT, WSOL_MINT } from '../config.js';
import { getPendingProposals, markProposalExecuted, getHatcherAgent, killHatcherAgent, reviveHatcherAgent, updateHatcherCaps } from '../db/hatcher.js';
import { buildUnsignedJupiterSwap } from '../liveExecutor.js';

export function getHatcherRouter() {
  const router = express.Router();
  
  // Middleware for Auth
  const hatcherAuth = (req, res, next) => {
    if (!ENABLE_HATCHER_PILOT) {
      return res.status(403).json({ error: 'Hatcher integration is disabled on this node.' });
    }
    const authHeader = req.headers.authorization || '';
    if (authHeader !== `Bearer hatcher_${HATCHER_PARTNER_API_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  router.use(hatcherAuth);

  // 1. GET /propose (Polling)
  router.get('/:agent_id/propose', async (req, res) => {
    const agentId = req.params.agent_id;
    const agent = getHatcherAgent(agentId);
    
    if (agent.is_killed) {
      return res.status(403).json({ error: 'Agent is killed. No new proposals.' });
    }

    const pending = getPendingProposals(agentId);
    if (!pending || pending.length === 0) {
      // Typically polling returns empty 200 or 404
      return res.status(200).json({ status: 'no_proposals' });
    }

    // Just return the oldest pending that is not expired
    const proposal = pending[0];
    
    const decision = JSON.parse(proposal.decision_json || '{}');
    const capsCheck = JSON.parse(proposal.caps_check_json || '{}');

    let unsignedTxBase64 = proposal.unsigned_tx_base64;
    let expectedOutputAmount = proposal.expected_output_amount;
    let slippageBps = proposal.slippage_bps;

    // Just-In-Time (JIT) Blockhash Generation
    // We generate it exactly when Hatcher polls to ensure the blockhash is 100% fresh
    if (!unsignedTxBase64 || unsignedTxBase64 === 'JIT') {
      try {
        const unsignedSwap = await buildUnsignedJupiterSwap({
          inputMint: WSOL_MINT,
          outputMint: proposal.mint,
          amount: parseInt(proposal.input_amount_lamports, 10),
          takerPubkey: proposal.wallet_pubkey,
          slippageBps: 300,
        });
        unsignedTxBase64 = unsignedSwap.unsignedTxBase64;
        expectedOutputAmount = unsignedSwap.expectedOutputAmount;
        slippageBps = unsignedSwap.slippageBps;
      } catch (err) {
        return res.status(500).json({ error: 'JIT Generation Failed: ' + err.message });
      }
    }

    return res.status(200).json({
      proposal_id: proposal.proposal_id,
      agent_id: proposal.agent_id,
      wallet_pubkey: proposal.wallet_pubkey,
      chain: proposal.chain,
      action: proposal.action,
      mint: proposal.mint,
      input_amount_lamports: proposal.input_amount_lamports,
      expected_output_amount: expectedOutputAmount,
      slippage_bps: slippageBps,
      unsigned_transaction: unsignedTxBase64,
      decision,
      caps_check: capsCheck,
      expires_at: new Date(proposal.expires_at_ms).toISOString()
    });
  });

  // 2. PUT /caps
  router.put('/:agent_id/caps', (req, res) => {
    const agentId = req.params.agent_id;
    const { max_trade_bps_of_wallet, max_daily_loss_bps, max_open_positions, wallet_pubkey } = req.body;
    
    const agent = getHatcherAgent(agentId);
    if (wallet_pubkey && agent.wallet_pubkey && agent.wallet_pubkey !== wallet_pubkey) {
      console.warn(`[SECURITY ALERT] Partner target wallet pubkey changed!`);
      console.warn(`  - Old: ${agent.wallet_pubkey}`);
      console.warn(`  - New: ${wallet_pubkey}`);
      console.warn(`  * Ensure this change was authorized by the partner.`);
    }

    // Default fallback if not provided
    const tradeBps = max_trade_bps_of_wallet || 50;
    const dailyLossBps = max_daily_loss_bps || 300;
    const openPos = max_open_positions || 2;

    updateHatcherCaps(agentId, {
      max_trade_bps: tradeBps,
      max_daily_loss_bps: dailyLossBps,
      max_open_positions: openPos
    }, wallet_pubkey);

    res.status(200).json({ status: 'success', message: 'Caps & Config updated.' });
  });

  // 3. POST /executed
  router.post('/:agent_id/executed', (req, res) => {
    const { proposal_id, status, tx_signature, reason } = req.body;
    if (!proposal_id || !status) {
      return res.status(400).json({ error: 'Missing proposal_id or status' });
    }
    markProposalExecuted(proposal_id, status, tx_signature || null, reason || '');
    // In prod: log to learning journal
    res.status(200).json({ status: 'success' });
  });

  // 4. POST /kill
  router.post('/:agent_id/kill', (req, res) => {
    const agentId = req.params.agent_id;
    killHatcherAgent(agentId);
    res.status(200).json({ status: 'killed', agent_id: agentId });
  });

  // 5. POST /revive (Unkill)
  router.post('/:agent_id/revive', (req, res) => {
    const agentId = req.params.agent_id;
    reviveHatcherAgent(agentId);
    res.status(200).json({ status: 'active', agent_id: agentId });
  });

  // 6. GET /status
  router.get('/:agent_id/status', (req, res) => {
    const agentId = req.params.agent_id;
    const agent = getHatcherAgent(agentId);
    res.status(200).json({
      agent_id: agentId,
      is_killed: !!agent.is_killed,
      caps: {
        max_trade_bps: agent.max_trade_bps,
        max_daily_loss_bps: agent.max_daily_loss_bps,
        max_open_positions: agent.max_open_positions
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
