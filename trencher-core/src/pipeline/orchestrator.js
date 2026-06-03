import { now, pruneSeen } from '../utils.js';
import { numSetting, boolSetting, strategySetting } from '../db/settings.js';
import { upsertCandidate, updateCandidateStatus, recentEligibleCandidates, candidateById } from '../db/candidates.js';
import { storeDecision, storeBatchDecision, logDecisionEvent } from '../db/decisions.js';
import { buildCandidate, filterCandidate, signalLabel } from './candidateBuilder.js';
import { decideCandidateBatch } from './llm.js';
import { activeStrategy } from '../db/settings.js';
import { createDryRunPosition, createLivePosition, canOpenMorePositions, openPositionCount, tradingMode } from '../db/positions.js';
import { sendBatchReveal, sendTelegram, sendPositionOpen, sendTradeIntent } from '../telegram/send.js';
import { candidateSummary } from '../telegram/format.js';
import { createTradeIntent } from '../db/intents.js';
import { refreshCandidateForExecution } from '../execution/positions.js';
import { executeLiveBuy } from '../execution/router.js';
import { graduated } from '../signals/graduated.js';
import { setDegenHandler } from '../signals/trending.js';
import { setCandidateHandler } from '../signals/feeClaim.js';
import { short } from '../format.js';
import { escapeHtml } from '../format.js';
import { isOnCooldown, setCooldown, getCooldownRemaining } from '../utils/mintCooldown.js';

export const seenSignalCandidates = new Map();

// 2.6 Hourly Trading Scheduler
const WITA_PAUSE_HOURS = [7, 8, 9, 10, 11, 12, 13, 14];
// UTC = WITA - 8
const UTC_PAUSE_HOURS = WITA_PAUSE_HOURS.map(h => (h - 8 + 24) % 24);

function isActiveHour() {
  const utcHour = new Date().getUTCHours();
  return !UTC_PAUSE_HOURS.includes(utcHour);
}

setDegenHandler(maybeProcessDegenCandidate);
setCandidateHandler(processCandidateFromSignals);

export async function processCandidateFromSignals(signals) {
  try {
  // Pause execution during dead zones
  if (!isActiveHour()) {
    console.log(`[scheduler] skipped processing ${signals.mint.slice(0, 8)}... (PAUSE HOUR)`);
    return;
  }

  const strat = activeStrategy();
  const { getBreedForStrategy } = await import('../db/agentDna.js');
  const breed = getBreedForStrategy(strat.id);
  const { db } = await import('../db/connection.js');
  const matchedAgents = db.prepare('SELECT id FROM agent_dna WHERE breed = ?').all(breed);
  const { canOpenMorePositionsForAgent, openPositionCountForAgent } = await import('../db/positions.js');
  const anyAgentCanOpen = matchedAgents.length === 0 || matchedAgents.some(agent => canOpenMorePositionsForAgent(agent.id));
  if (!anyAgentCanOpen) {
    const max = strat.max_open_positions ?? numSetting('max_open_positions', 3);
    console.log(`[agent] all matching agents for strategy ${strat.id} reached max open positions, skipping ${signals.mint.slice(0, 8)}...`);
    return;
  }

  // Skip if mint is on cooldown
  if (isOnCooldown(signals.mint)) {
    const remaining = getCooldownRemaining(signals.mint);
    console.log(`[COOLDOWN] SKIP ${signals.mint.slice(0, 8)}... — ${remaining}m left`);
    return;
  }

  const candidate = await buildCandidate(signals);
  const signature = signals.signature || null;
  const candidateId = upsertCandidate(candidate, signature);
  if (!candidate.filters.passed) {
    console.log(`[candidate] filtered ${candidate.token.mint.slice(0, 8)}... ${candidate.filters.failures.join('; ')}`);
    return;
  }

  let rows, batchDecision, batchId;

  if (!strat.use_llm) {
    const selfRow = candidateById(candidateId);
    rows = selfRow ? [selfRow] : [];
    batchId = null;
    batchDecision = {
      verdict: 'BUY',
      confidence: 100,
      selected_candidate_id: candidateId,
      selected_mint: candidate.token.mint,
      selected_row: selfRow,
      reason: `Strategy '${strat.id}' is rule-based (use_llm: false); filters passed.`,
      risks: [],
      suggested_tp_percent: strat.tp_percent ?? numSetting('default_tp_percent', 50),
      suggested_sl_percent: strat.sl_percent ?? numSetting('default_sl_percent', -25),
      raw: null,
    };
  } else {
    rows = recentEligibleCandidates(numSetting('llm_candidate_pick_count', 10));
    batchDecision = await decideCandidateBatch(rows, candidateId);
    batchId = storeBatchDecision(candidateId, rows, batchDecision);
  }
  const selectedRow = batchDecision.selected_row;
  const selectedThisCandidate = selectedRow?.id === candidateId;
  const currentDecision = selectedThisCandidate
    ? batchDecision
    : {
        ...batchDecision,
        verdict: 'WATCH',
        reason: selectedRow
          ? `Batch #${batchId} screened ${rows.length}; selected ${short(selectedRow.candidate.token.mint)} instead. ${batchDecision.reason || ''}`.trim()
          : `Batch #${batchId} screened ${rows.length}; no buy selected. ${batchDecision.reason || ''}`.trim(),
      };
  const currentDecisionId = storeDecision(candidateId, candidate, currentDecision);
  currentDecision.id = currentDecisionId;
  updateCandidateStatus(candidateId, currentDecision.verdict.toLowerCase());

  if (selectedRow && !selectedThisCandidate) {
    const selectedDecisionId = storeDecision(selectedRow.id, selectedRow.candidate, batchDecision);
    batchDecision.id = selectedDecisionId;
    updateCandidateStatus(selectedRow.id, batchDecision.verdict.toLowerCase());
  } else if (selectedThisCandidate) {
    batchDecision.id = currentDecisionId;
  }

  if (batchId) await sendBatchReveal(batchId, rows, batchDecision, candidateId);

  if (selectedRow && boolSetting('agent_enabled', true) && batchDecision.verdict === 'BUY' && batchDecision.confidence >= strategySetting('llm_min_confidence', 75)) {
    if (!canOpenMorePositions()) {
      const max = numSetting('max_open_positions', 3);
      console.log(`[agent] max open positions reached (${openPositionCount()}/${max}), skipping buy ${selectedRow.candidate.token.mint}`);
      logDecisionEvent({
        batchId,
        triggerCandidateId: candidateId,
        selectedRow,
        rows,
        decision: batchDecision,
        action: 'entry_skipped_max_positions',
        guardrails: { maxOpenPositions: max, openPositions: openPositionCount() },
      });
      return;
    }
    await handleApprovedBuy(selectedRow, batchDecision, batchId, rows, candidateId);
  } else {
    logDecisionEvent({
      batchId,
      triggerCandidateId: candidateId,
      selectedRow,
      rows,
      decision: batchDecision,
      action: selectedRow ? 'entry_not_approved' : 'no_candidate_selected',
      guardrails: {
        agentEnabled: boolSetting('agent_enabled', true),
        confidenceThreshold: strategySetting('llm_min_confidence', 75),
        openPositions: openPositionCount(),
        maxOpenPositions: numSetting('max_open_positions', 3),
      },
    });
  }
  } catch (err) { console.log(`[orchestrator] processCandidateFromSignals failed: ${err.message}`);  }
}

export async function handleApprovedBuy(selectedRow, decision, batchId, rows = [], triggerCandidateId = null) {
  const freshSelectedRow = await refreshCandidateForExecution(selectedRow);
  const executionRows = rows.map(row => row.id === freshSelectedRow.id ? freshSelectedRow : row);
  if (!freshSelectedRow.candidate.filters?.passed) {
    updateCandidateStatus(freshSelectedRow.id, 'stale_rejected');
    logDecisionEvent({
      batchId,
      triggerCandidateId,
      selectedRow: freshSelectedRow,
      rows: executionRows,
      decision,
      mode: 'unknown',
      action: 'entry_rejected_fresh_filters',
      guardrails: {
        failures: freshSelectedRow.candidate.filters?.failures || [],
        refreshedAtMs: freshSelectedRow.candidate.executionRefresh?.refreshedAtMs,
      },
    });
    await sendTelegram([
      '🛑 <b>Execution rejected on fresh check</b>',
      '',
      candidateSummary(freshSelectedRow.candidate, decision),
      '',
      `Failures: ${escapeHtml((freshSelectedRow.candidate.filters?.failures || []).join('; ') || 'fresh execution guard failed')}`,
    ].join('\n'));
    return;
  }
  
  // Momentum Check: Reject if price dumped >15% since LLM checked (unless we are dip buying)
  const origPrice = Number(selectedRow.candidate.metrics?.priceUsd || 0);
  const freshPrice = Number(freshSelectedRow.candidate.metrics?.priceUsd || 0);
  const strat = (await import('../db/settings.js')).activeStrategy();
  if (strat?.entry_mode !== 'wait_for_dip' && origPrice > 0 && freshPrice > 0 && freshPrice < origPrice * 0.85) {
    console.log(`[orchestrator] Momentum killed: Price dumped from ${origPrice} to ${freshPrice}. Aborting.`);
    return;
  }

  const { getBreedForStrategy } = await import('../db/agentDna.js');
  const { db } = await import('../db/connection.js');
  const { canOpenMorePositionsForAgent, openPositionCountForAgent } = await import('../db/positions.js');

  const breed = getBreedForStrategy(strat.id);
  let matchedAgents = db.prepare('SELECT id, execution_mode FROM agent_dna WHERE breed = ?').all(breed);
  if (matchedAgents.length === 0) {
    matchedAgents = [{ id: null, execution_mode: tradingMode() }];
  }

  for (const agent of matchedAgents) {
    const mode = agent.execution_mode || 'dry_run';

    if (!canOpenMorePositionsForAgent(agent.id)) {
      const max = strat.max_open_positions ?? numSetting('max_open_positions', 3);
      console.log(`[agent] max open positions reached for agent ${agent.id || 'global'} (${openPositionCountForAgent(agent.id)}/${max}), skipping buy`);
      continue;
    }

    if (mode === 'dry_run') {
      const positionId = await createDryRunPosition(freshSelectedRow.id, freshSelectedRow.candidate, decision, `llm_batch_${batchId}`, agent.id);
      logDecisionEvent({
        batchId,
        triggerCandidateId,
        selectedRow: freshSelectedRow,
        rows: executionRows,
        decision,
        mode,
        action: 'dry_run_entry',
        guardrails: { maxOpenPositions: strat.max_open_positions ?? numSetting('max_open_positions', 3), openPositions: openPositionCountForAgent(agent.id) },
        execution: { positionId },
      });
      await sendPositionOpen(positionId);
    } else if (mode === 'confirm') {
      const intentId = createTradeIntent(freshSelectedRow.id, freshSelectedRow.candidate, decision, mode, 'pending_confirmation');
      logDecisionEvent({
        batchId,
        triggerCandidateId,
        selectedRow: freshSelectedRow,
        rows: executionRows,
        decision,
        mode,
        action: 'confirm_intent_created',
        guardrails: { maxOpenPositions: strat.max_open_positions ?? numSetting('max_open_positions', 3), openPositions: openPositionCountForAgent(agent.id) },
        execution: { intentId },
      });
      await sendTradeIntent(intentId, freshSelectedRow.candidate, decision);
    } else if (mode === 'live') {
      try {
        await executeLiveBuy(freshSelectedRow, decision, batchId, executionRows, triggerCandidateId, agent.id);
      } catch (err) {
        const intentId = createTradeIntent(freshSelectedRow.id, freshSelectedRow.candidate, decision, mode, 'execution_failed');
        logDecisionEvent({
          batchId,
          triggerCandidateId,
          selectedRow: freshSelectedRow,
          rows: executionRows,
          decision,
          mode,
          action: 'live_entry_failed',
          guardrails: { maxOpenPositions: strat.max_open_positions ?? numSetting('max_open_positions', 3), openPositions: openPositionCountForAgent(agent.id) },
          execution: { intentId, error: err.message },
        });
        await sendTelegram([
          '🛑 <b>Live trade failed</b>',
          '',
          candidateSummary(freshSelectedRow.candidate, decision),
          '',
          `Intent #${intentId} stored.`,
          `Error: ${escapeHtml(err.message)}`,
        ].join('\n'));
      }
    }
  }
}

export async function maybeProcessDegenCandidate(mint, trendingToken) {
  if (!boolSetting('trending_allow_degen', false)) return;
  const graduatedCoin = graduated.get(mint);
  if (!graduatedCoin) return;
  pruneSeen(seenSignalCandidates, 10 * 60 * 1000);
  const bucket = Math.floor(now() / (5 * 60 * 1000));
  const key = `graduated_trending:${mint}:${bucket}`;
  if (seenSignalCandidates.has(key)) return;
  seenSignalCandidates.set(key, now());
  await processCandidateFromSignals({
    mint,
    graduatedCoin,
    trendingToken,
    route: 'graduated_trending',
  });
}
