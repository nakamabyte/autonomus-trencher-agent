import { now, json } from '../utils.js';
import { numSetting, boolSetting } from '../db/settings.js';
import { db } from '../db/connection.js';
import { WSOL_MINT, LIVE_MIN_SOL_RESERVE_LAMPORTS, ENABLE_HATCHER_PILOT, HATCHER_AGENT_PUBKEY, HATCHER_AGENT_ID, HATCHER_WEBHOOK_URL } from '../config.js';
import { escapeHtml, fmtSol } from '../format.js';
import { executeJupiterSwap, liveWalletBalanceLamports, fetchLiveTokenBalance, buildUnsignedJupiterSwap } from '../liveExecutor.js';
import { getHatcherAgent, createHatcherProposal, pushHatcherWebhook } from '../db/hatcher.js';
import { executeBaseSwap } from './baseExecutor.js';
import { activeStrategy } from '../db/settings.js';
import { createLivePosition, canOpenMorePositions, openPositionCount } from '../db/positions.js';
import { intentById } from '../db/intents.js';
import { logDecisionEvent } from '../db/decisions.js';
import { refreshCandidateForExecution } from './positions.js';
import { bot } from '../telegram/bot.js';
import { candidateSummary } from '../telegram/format.js';
import { sendPositionOpen, sendTelegram } from '../telegram/send.js';
import { updateCandidateStatus } from '../db/candidates.js';
import { createTradeIntent } from '../db/intents.js';
import { setCooldown } from '../utils/mintCooldown.js';

export async function executeLiveBuy(selectedRow, decision, batchId, rows = [], triggerCandidateId = null, agentDnaId = null) {
  const strat = activeStrategy();
  const chain = selectedRow.candidate.chain || 'solana';
  let swap;

  if (chain === 'base') {
    const amountEth = strat.position_size_eth || 0.005;
    swap = await executeBaseSwap({
      tokenAddress: selectedRow.candidate.token.mint,
      side: 'buy',
      amount: amountEth
    });
  } else {
    const amountLamports = Math.floor((strat.position_size_sol ?? numSetting('dry_run_buy_sol', 0.1)) * 1_000_000_000);
    const balance = await liveWalletBalanceLamports();
    if (balance < amountLamports + LIVE_MIN_SOL_RESERVE_LAMPORTS) {
      throw new Error(`Insufficient SOL balance. Need ${fmtSol((amountLamports + LIVE_MIN_SOL_RESERVE_LAMPORTS) / 1_000_000_000)} SOL including reserve.`);
    }
    swap = await executeJupiterSwap({
      inputMint: WSOL_MINT,
      outputMint: selectedRow.candidate.token.mint,
      amount: amountLamports,
    });
  }
  if (!swap.outputAmount) {
    swap.outputAmount = await fetchLiveTokenBalance(selectedRow.candidate.token.mint) || swap.outputAmount;
  }
  const positionId = createLivePosition(selectedRow.id, selectedRow.candidate, decision, swap, `live_batch_${batchId}`, agentDnaId);
  logDecisionEvent({
    batchId,
    triggerCandidateId,
    selectedRow,
    rows,
    decision,
    mode: 'live',
    action: 'live_entry_executed',
    guardrails: { balanceLamports: chain === 'solana' ? await liveWalletBalanceLamports() : 0, amountLamports: chain === 'solana' ? Math.floor((strat.position_size_sol ?? 0.1) * 1_000_000_000) : 0, minReserveLamports: LIVE_MIN_SOL_RESERVE_LAMPORTS, chain },
    execution: { positionId, swap },
  });
  await sendPositionOpen(positionId);

  // Trigger parallel Hatcher proposal generation (Fire-and-Forget)
  if (ENABLE_HATCHER_PILOT && chain === 'solana' && HATCHER_AGENT_ID) {
    setTimeout(async () => {
      try {
        const agent = getHatcherAgent(HATCHER_AGENT_ID);
        if (agent.is_killed) return;
        
        const targetPubkey = agent.wallet_pubkey || HATCHER_AGENT_PUBKEY;
        if (!targetPubkey) {
          console.log(`[Hatcher] Cannot generate parallel proposal: wallet_pubkey is missing.`);
          return;
        }

        const amountLamports = Math.floor((strat.position_size_sol ?? numSetting('dry_run_buy_sol', 0.1)) * 1_000_000_000);
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
          action: 'buy',
          mint: selectedRow.candidate.token.mint,
          inputAmountLamports: String(amountLamports),
          expectedOutputAmount: '0', // Will be populated during JIT phase
          slippageBps: 300,
          unsignedTxBase64: 'JIT', // Generated Just-In-Time when Hatcher polls
          decisionJson: {
            lane: decision.lane || selectedRow.candidate.signals?.route || 'raw_scan',
            caller: decision.caller || selectedRow.candidate.sourceMeta?.callerMeta?.callerHandle || 'system',
            caller_trust: decision.caller_trust || 'Unknown',
            source_group: decision.source_group || 'Unknown',
            confidence: decision.confidence,
            verdict: decision.verdict || decision.action,
            hits: decision.hits || selectedRow.candidate.sourceMeta?.callerMeta?.sentiment?.rawHits || [],
            read: decision.read || decision.reason || selectedRow.candidate.sourceMeta?.callerMeta?.sentiment?.read || 'Automated buy',
            signals: decision.signals || {
              rug_probability: selectedRow.candidate.trending?.rug_ratio || 0,
              bundler_ratio: selectedRow.candidate.trending?.bundler_rate || 0,
              smart_money_overlap: (selectedRow.candidate.metrics?.trendingSmartDegenCount || 0) > 0,
              runner_signal: !!selectedRow.candidate.signals?.route,
              liquidity_usd: selectedRow.candidate.metrics?.liquidityUsd || 0
            }
          },
          capsCheckJson: capsCheck,
          expiresAtMs
        });
        
        if (HATCHER_WEBHOOK_URL) {
          try {
            // Build unsigned TX immediately for webhook Push
            const jitSwap = await buildUnsignedJupiterSwap({
              inputMint: WSOL_MINT,
              outputMint: selectedRow.candidate.token.mint,
              amount: amountLamports,
              takerPubkey: targetPubkey,
              slippageBps: 300,
            });
            const payload = {
              agent_id: HATCHER_AGENT_ID,
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
                input_mint: WSOL_MINT,
                output_mint: selectedRow.candidate.token.mint,
                input_amount_lamports: String(amountLamports),
                expected_output_amount: jitSwap.expectedOutputAmount,
                slippage_bps: 300
              },
              signal_payload: decisionJson,
              dry_run: false
            };
            await pushHatcherWebhook(payload);
          } catch (e) {
            console.error(`[Hatcher Webhook] Failed to build or push JIT:`, e.message);
          }
        }
        
        console.log(`[Hatcher] Generated parallel unsigned proposal for ${selectedRow.candidate.token.mint}`);
      } catch (err) {
        console.error(`[Hatcher] Parallel proposal generation failed:`, err.message);
      }
    }, 0);
  }
}

export async function executeLiveSell(position, reason) {
  const amount = position.token_amount_raw || position.token_amount_est;
  if (!amount || Number(amount) <= 0) throw new Error('Live position has no token amount to sell.');
  
  const isCopyTrade = position.strategy_id === 'copytrade';
  const isBase = position.strategy_id === 'base_sniper' || (position.snapshot_json && JSON.parse(position.snapshot_json).candidate?.chain === 'base');
  
  if (isBase) {
    return executeBaseSwap({
      tokenAddress: position.mint,
      side: 'sell',
      amount
    });
  } else {
    return executeJupiterSwap({
      inputMint: position.mint,
      outputMint: WSOL_MINT,
      amount,
      useJito: isCopyTrade ? process.env.COPYTRADE_USE_JITO !== 'false' : undefined,
      priorityFee: isCopyTrade ? (process.env.COPYTRADE_PRIORITY_FEE || 'VeryHigh') : undefined,
    });
  }
}

export async function executeConfirmedIntent(chatId, intentId) {
  const intent = intentById(intentId);
  if (!intent || intent.status !== 'pending_confirmation') return bot.sendMessage(chatId, 'Pending intent not found.');
  if (!canOpenMorePositions()) {
    return bot.sendMessage(chatId, `Max open positions reached (${openPositionCount()}/${numSetting('max_open_positions', 3)}).`);
  }
  const { decision } = intent.payload;
  try {
    const freshRow = await refreshCandidateForExecution({
      id: intent.candidate_id,
      candidate: intent.payload.candidate,
    });
    if (!freshRow.candidate.filters?.passed) {
      db.prepare('UPDATE trade_intents SET status = ?, updated_at_ms = ? WHERE id = ?').run('rejected_stale', now(), intentId);
      return bot.sendMessage(chatId, [
        '🛑 <b>Trade intent rejected on fresh check</b>',
        '',
        candidateSummary(freshRow.candidate, decision),
        '',
        `Failures: ${escapeHtml((freshRow.candidate.filters?.failures || []).join('; ') || 'fresh execution guard failed')}`,
      ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
    }
    const strat = activeStrategy();
    const chain = freshRow.candidate.chain || 'solana';
    let swap;
    
    if (chain === 'base') {
      const amountEth = strat.position_size_eth || 0.005;
      swap = await executeBaseSwap({
        tokenAddress: freshRow.candidate.token.mint,
        side: 'buy',
        amount: amountEth
      });
    } else {
      const amountLamports = Math.floor((strat.position_size_sol ?? numSetting('dry_run_buy_sol', 0.1)) * 1_000_000_000);
      const balance = await liveWalletBalanceLamports();
      if (balance < amountLamports + LIVE_MIN_SOL_RESERVE_LAMPORTS) {
        db.prepare('UPDATE trade_intents SET status = ?, updated_at_ms = ? WHERE id = ?').run('rejected_insufficient_balance', now(), intentId);
        return bot.sendMessage(chatId, `Insufficient SOL balance. Need ${fmtSol((amountLamports + LIVE_MIN_SOL_RESERVE_LAMPORTS) / 1_000_000_000)} SOL.`, { parse_mode: 'HTML' });
      }
      swap = await executeJupiterSwap({
        inputMint: WSOL_MINT,
        outputMint: freshRow.candidate.token.mint,
        amount: amountLamports,
      });
    }
    if (!swap.outputAmount) {
      swap.outputAmount = await fetchLiveTokenBalance(freshRow.candidate.token.mint) || swap.outputAmount;
    }
    const positionId = createLivePosition(intent.candidate_id, freshRow.candidate, decision, swap, `confirmed_intent_${intentId}`);
    db.prepare('UPDATE trade_intents SET status = ?, updated_at_ms = ? WHERE id = ?').run('executed_live', now(), intentId);
    logDecisionEvent({
      batchId: null,
      triggerCandidateId: intent.candidate_id,
      selectedRow: freshRow,
      rows: [],
      decision,
      mode: 'live',
      action: 'confirmed_intent_executed',
      guardrails: { balanceLamports: balance, amountLamports, intentId },
      execution: { positionId, swap },
    });
    return sendPositionOpen(positionId);
  } catch (err) {
    db.prepare('UPDATE trade_intents SET status = ?, updated_at_ms = ? WHERE id = ?').run('execution_failed', now(), intentId);
    return bot.sendMessage(chatId, `Live execution failed: ${escapeHtml(err.message)}`, { parse_mode: 'HTML' });
  }
}

export async function rejectIntent(chatId, intentId) {
  const intent = intentById(intentId);
  if (!intent) return bot.sendMessage(chatId, 'Intent not found.');
  db.prepare('UPDATE trade_intents SET status = ?, updated_at_ms = ? WHERE id = ?').run('rejected', now(), intentId);
  return bot.sendMessage(chatId, `Rejected trade intent #${intentId}.`);
}
