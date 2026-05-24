import axios from 'axios';
import { ENABLE_LLM, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_TIMEOUT_MS, DEEPSEEK_API_KEY, GROK_API_KEY } from '../config.js';
import { now, stripThinking, strictJsonFromText } from '../utils.js';
import { numSetting } from '../db/settings.js';
import { db } from '../db/connection.js';
import { screenCandidates } from '../agents/llmScreener.js';

export function normalizeDecision(parsed, fallbackReason = '') {
  const verdict = ['BUY', 'WATCH', 'PASS'].includes(String(parsed?.verdict).toUpperCase())
    ? String(parsed.verdict).toUpperCase()
    : 'WATCH';
  return {
    verdict,
    confidence: Math.max(0, Math.min(100, Number(parsed?.confidence) || 0)),
    reason: String(parsed?.reason || fallbackReason).slice(0, 1000),
    risks: Array.isArray(parsed?.risks) ? parsed.risks.map(String).slice(0, 8) : [],
    suggested_tp_percent: parsed?.suggested_tp_percent !== undefined ? Math.abs(Number(parsed.suggested_tp_percent) || 0) : numSetting('default_tp_percent', 50),
    suggested_sl_percent: parsed?.suggested_sl_percent !== undefined ? -Math.abs(Number(parsed.suggested_sl_percent) || 0) : numSetting('default_sl_percent', -25),
    x_narrative: String(parsed?.x_narrative || '').trim(),
    raw: parsed,
  };
}

export function activeLessonsForPrompt(limit = 6) {
  return db.prepare(`
    SELECT lesson
    FROM learning_lessons
    WHERE status = 'active'
    ORDER BY id DESC
    LIMIT ?
  `).all(limit).map(row => row.lesson);
}

export function compactCandidateForLlm(row) {
  const c = row.candidate;
  const athWindow = c.chart?.windows?.find(window => window.label === 'ath_context_24h_5m' && window.available)
    || c.chart?.windows?.find(window => window.label === 'recent_24h_5m' && window.available);
  return {
    candidate_id: row.id,
    mint: c.token?.mint,
    route: c.signals?.route,
    signals: c.signals,
    token: c.token,
    metrics: c.metrics,
    feeClaim: c.feeClaim,
    trending: c.trending,
    graduation: c.graduation,
    holders: c.holders,
    chart: {
      purpose: 'ATH/range context only. Do not treat large 24h change as bullish/bearish momentum by itself.',
      currentNative: c.chart?.currentNative,
      rangeHighNative: c.chart?.rangeHighNative,
      distanceFromAthPercent: c.chart?.distanceFromAthPercent ?? c.chart?.belowRangeHighPercent,
      topBlastRisk: c.chart?.topBlastRisk,
      athContext24h: athWindow ? {
        current: athWindow.current,
        high: athWindow.high,
        low: athWindow.low,
        distanceFromHighPercent: athWindow.belowHighPercent,
        aboveLowPercent: athWindow.aboveLowPercent,
      } : null,
      windows: c.chart?.windows,
    },
    savedWalletExposure: c.savedWalletExposure,
    twitterNarrative: c.twitterNarrative,
    filters: c.filters,
  };
}


export async function decideCandidateBatch(rows, triggerCandidateId) {
  if (!ENABLE_LLM) {
    return {
      verdict: 'WATCH',
      confidence: 0,
      selected_candidate_id: null,
      selected_mint: null,
      reason: 'LLM disabled.',
      risks: ['no_llm_decision'],
      suggested_tp_percent: numSetting('default_tp_percent', 50),
      suggested_sl_percent: numSetting('default_sl_percent', -25),
      raw: null,
    };
  }

  const candidatesData = rows.map(compactCandidateForLlm);
  
  try {
    const result = await screenCandidates(candidatesData);
    
    const verdict = result.decision === 'BUY' ? 'BUY' : 'PASS';
    const selectedMint = result.mint || '';
    const row = rows.find(item => item.candidate.token?.mint === selectedMint);
    
    return {
      verdict,
      confidence: Math.round(Number(result.confidence || 0) * 100),
      reason: result.reasoning || '',
      risks: [],
      suggested_tp_percent: numSetting('default_tp_percent', 50),
      suggested_sl_percent: numSetting('default_sl_percent', -25),
      x_narrative: result.kol_signal ? `KOL Signal Detected: ${result.kol_signal}

${result.reasoning}` : result.reasoning || '',
      raw: result,
      selected_candidate_id: verdict === 'BUY' && row ? row.id : null,
      selected_mint: verdict === 'BUY' && row ? row.candidate.token.mint : null,
      selected_row: verdict === 'BUY' && row ? row : null,
    };
  } catch (err) {
    console.error('[llm] cascade failed:', err.message);
    return {
      verdict: 'PASS',
      confidence: 0,
      selected_candidate_id: null,
      selected_mint: null,
      reason: `Cascade LLM Error: ${err.message}`,
      risks: ['llm_error'],
      suggested_tp_percent: numSetting('default_tp_percent', 50),
      suggested_sl_percent: numSetting('default_sl_percent', -25),
      raw: { error: err.message },
    };
  }
}
