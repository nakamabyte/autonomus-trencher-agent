import axios from 'axios';
import { ENABLE_LLM, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_TIMEOUT_MS, DEEPSEEK_API_KEY, GROK_API_KEY } from '../config.js';
import { now, stripThinking, strictJsonFromText } from '../utils.js';
import { numSetting } from '../db/settings.js';
import { db } from '../db/connection.js';

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
  if (!ENABLE_LLM || !LLM_API_KEY || !DEEPSEEK_API_KEY || !GROK_API_KEY) {
    return {
      verdict: 'WATCH',
      confidence: 0,
      selected_candidate_id: null,
      selected_mint: null,
      reason: 'LLM disabled or missing API Keys (need Claude, DeepSeek, Grok).',
      risks: ['no_llm_decision'],
      suggested_tp_percent: numSetting('default_tp_percent', 50),
      suggested_sl_percent: numSetting('default_sl_percent', -25),
      raw: null,
    };
  }

  const candidatesData = rows.map(compactCandidateForLlm);
  const recentLessons = activeLessonsForPrompt();

  // STEP 1: CLAUDE OPUS (Conductor)
  const claudeSystem = `You are the Conductor for a Meme Coin Trench operation.
Analyze the provided candidates briefly. Exclude obvious trash. Provide a strategic research direction for the Worker.
Do not output JSON, just return your strategic plan and focus points.`;
  const claudeUser = `Task: Plan the analysis for these meme coin candidates.\n\nCandidates: ${JSON.stringify(candidatesData)}\nLessons: ${recentLessons}`;
  
  let claudePlan = '';
  try {
    const res = await axios.post(`${LLM_BASE_URL.replace(/\/$/, '')}/messages`, {
      model: LLM_MODEL,
      temperature: 0.2,
      system: claudeSystem,
      max_tokens: 1024,
      messages: [{ role: 'user', content: claudeUser }],
    }, {
      timeout: LLM_TIMEOUT_MS,
      headers: { 'x-api-key': LLM_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    });
    claudePlan = res.data?.content?.[0]?.text || '';
    console.log(`[llm] Claude Conductor plan completed.`);
  } catch (err) {
    console.log(`[llm] Claude Conductor failed: ${err.message}`);
    throw err;
  }

  // STEP 2: DEEPSEEK (Worker/Grinder)
  const deepseekSystem = `You are the Worker Grinder. You will receive a strategic plan from the Conductor and candidate data.
Your job is to execute the analysis and draft an engaging X (Twitter) narrative for the best candidate (if any).
Return your full analysis and the draft narrative. Do not output JSON.`;
  const deepseekUser = `Conductor Plan:\n${claudePlan}\n\nCandidates:\n${JSON.stringify(candidatesData)}`;
  
  let deepseekAnalysis = '';
  try {
    const res = await axios.post(`https://api.deepseek.com/chat/completions`, {
      model: 'deepseek-chat',
      temperature: 0.4,
      messages: [
        { role: 'system', content: deepseekSystem },
        { role: 'user', content: deepseekUser },
      ],
    }, {
      timeout: LLM_TIMEOUT_MS,
      headers: { authorization: `Bearer ${DEEPSEEK_API_KEY}`, 'content-type': 'application/json' },
    });
    deepseekAnalysis = res.data?.choices?.[0]?.message?.content || '';
    console.log(`[llm] DeepSeek Worker analysis completed.`);
  } catch (err) {
    console.log(`[llm] DeepSeek Worker failed: ${err.message}`);
    throw err;
  }

  // STEP 3: GROK (Critic)
  const grokSystem = `You are the Critic and JSON Formatter. 
You will receive the Worker's analysis and draft X (Twitter) narrative.
Your job is to review the decision, refine the narrative to be highly engaging for Crypto X, and output the final decision in STRICT JSON ONLY.
Output Schema:
{
  "verdict": "BUY|WATCH|PASS",
  "selected_candidate_id": integer or null,
  "selected_mint": string or null,
  "confidence": number 0-100,
  "reason": "short explanation",
  "risks": ["risk 1", "risk 2"],
  "suggested_tp_percent": positive number,
  "suggested_sl_percent": negative number,
  "x_narrative": "Highly engaging tweet draft"
}`;
  const grokUser = `Worker Analysis & Draft:\n${deepseekAnalysis}\n\nReview this, pick the best (or PASS), refine the X narrative, and output strict JSON.`;

  let grokJson = '';
  try {
    const res = await axios.post(`https://api.x.ai/v1/chat/completions`, {
      model: 'grok-4.3',
      temperature: 0.2,
      messages: [
        { role: 'system', content: grokSystem },
        { role: 'user', content: grokUser },
      ],
    }, {
      timeout: LLM_TIMEOUT_MS,
      headers: { authorization: `Bearer ${GROK_API_KEY}`, 'content-type': 'application/json' },
    });
    grokJson = res.data?.choices?.[0]?.message?.content || '';
    console.log(`[llm] Grok Critic review completed.`);
  } catch (err) {
    console.log(`[llm] Grok Critic failed: ${err.message}`);
    throw err;
  }

  try {
    const parsed = strictJsonFromText(grokJson);
    const decision = normalizeDecision(parsed);
    const selectedId = Number(parsed.selected_candidate_id);
    const selectedMint = String(parsed.selected_mint || '');
    const row = rows.find(item => item.id === selectedId || item.candidate.token?.mint === selectedMint);
    return {
      ...decision,
      selected_candidate_id: decision.verdict === 'BUY' && row ? row.id : null,
      selected_mint: decision.verdict === 'BUY' && row ? row.candidate.token.mint : null,
      selected_row: decision.verdict === 'BUY' && row ? row : null,
    };
  } catch (err) {
    console.log(`[llm] batch parse failed: ${err.message}`);
    return {
      verdict: 'WATCH',
      confidence: 0,
      selected_candidate_id: null,
      selected_mint: null,
      reason: `LLM parse failed: ${err.message}`,
      risks: ['llm_error'],
      suggested_tp_percent: numSetting('default_tp_percent', 50),
      suggested_sl_percent: numSetting('default_sl_percent', -25),
      raw: { error: err.message },
    };
  }
}

export async function decideCandidate(candidate) {
  const pseudoRow = { id: 0, candidate };
  const decision = await decideCandidateBatch([pseudoRow], 0);
  return normalizeDecision(decision.raw || decision, decision.reason);
}
