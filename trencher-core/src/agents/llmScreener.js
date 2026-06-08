import OpenAI from 'openai';
import { LLM_T1_BASE_URL, LLM_T1_API_KEY, LLM_T1_MODEL, LLM_T1_CONFIDENCE_PASS, LLM_T1_CONFIDENCE_BUY, LLM_T2_BASE_URL, LLM_T2_API_KEY, LLM_T2_MODEL, LLM_T2_CONFIDENCE_BUY } from '../config.js';
import { logDecision } from '../consciousness/decisionLog.js';

const t1Client = new OpenAI({
  baseURL: LLM_T1_BASE_URL,
  apiKey: LLM_T1_API_KEY
});

const t2Client = new OpenAI({
  baseURL: LLM_T2_BASE_URL,
  apiKey: LLM_T2_API_KEY
});

const SYSTEM_PROMPT_T1 = `You are TRENCHER-T1, the first-pass bulk screener inside Trencher Agent —
a 19-agent autonomous Solana trading orchestrator focused on Pump.fun tokens.

Your job is fast, high-volume filtering. Minimum confidence to BUY is 0.75.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISION THRESHOLDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
confidence >= 0.80   → BUY (execute immediately)
confidence 0.75–0.79 → ESCALATE (pass to Tier 2)
confidence < 0.75    → SKIP
HARD FLOOR: Never output BUY with confidence < 0.75.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JSON array of candidates:
{
  "mint": "token_address",
  "symbol": "TICKER",
  "strategy": "sniper | dip_buy | smart_money | degen",
  "signal_sources": ["helius", "jupiter", "graduated"],
  "source_count": 2,
  "token_age_minutes": 45,
  "mcap_usd": 55000,
  "holders": 420,
  "liquidity_usd": 22000,
  "price_delta_5m": 0.12,
  "price_delta_1h": -0.08,
  "price_delta_24h": -0.41,
  "ath_distance_pct": -38,
  "bundler_rate": 0.04,
  "rug_ratio": 0.02,
  "smart_money_overlap": 2,
  "top_trader_activity": "buying",
  "ct_narrative": "raw FXTwitter text",
  "strategy_gate_score": 0.74
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — HARD VETO (check first, instant SKIP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- bundler_rate > 0.15
- rug_ratio > 0.08
- token_age_minutes > 240 with no confirmed runner signal
- ct_narrative contains: "buy my bags", "guaranteed", "paid promotion", "pump group"
- source_count = 1 AND smart_money_overlap = 0 AND no runner signal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — RUNNER DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scan ct_narrative for these patterns before applying mcap filter.

--- PATTERN A: SOLANA ECOSYSTEM REPLY RUNNER ---
Cabals monitor these accounts 24/7 and deploy tokens within 1–5 min of their tweets.

- @aeyakovenko (Toly, Solana co-founder) → +0.18
- @alon_p2p (Alon, pump.fun founder) → +0.20
- @pumpdotfun (pump.fun official) → +0.20
- @mertmumtaz (Mert, Helius CEO) → +0.15
- @rajgokal (Solana co-founder) → +0.13
- @Austin_Federa (Solana Foundation) → +0.10
- @Lily_Liu_Sol (Solana Foundation President) → +0.10

Entry window: 5–60 min post-deploy
@alon_p2p or @pumpdotfun trigger: tighter window, 5–30 min
If token_age_minutes > 120: window likely closed, apply -0.05

--- PATTERN B: GLOBAL AI/TECH REPLY RUNNER ---
- @sama (Sam Altman, OpenAI CEO) → +0.12
- @elonmusk (Elon Musk) → +0.12
- @VitalikButerin (Ethereum founder) → +0.10
- @gdb (Greg Brockman, OpenAI) → +0.08
- @ilyasut (Ilya Sutskever, SSI) → +0.08
- @demishassabis (Google DeepMind CEO) → +0.08
- Any billionaire/CEO >1M followers → +0.07

Entry window: within 4 hours of viral tweet

Detection signals in ct_narrative:
- Token name = phrase from viral tweet
- Symbol references trending X moment
- ct_narrative explicitly references the account's tweet
- Deploy timestamp close to viral tweet timestamp

--- PATTERN C: LEGIT TECH/AI NARRATIVE ---

GENUINE (apply boost):
- Real AI agent or autonomous AI with describable use case → +0.10
- Onchain finance infra (DEX tool, yield, quant) → +0.09
- Real GitHub repo linked or referenced in CT → +0.08
- Novel crypto primitive or mechanism → +0.07
- Token connected to actual AI/tech ecosystem event → +0.07

GITHUB META extra bonus:
ct_narrative contains github.com link OR references real commits → +0.07

LARP TECH (apply penalty):
- "AI" or "GPT" in name, no coherent angle → -0.05
- Fake tech buzzwords, no product → -0.05
- Copy of previous runner name → -0.07
- Paid shill with tech framing → -0.08

--- PATTERN D: CABAL COORDINATION ---
Multiple CT accounts posting same CA within 1 hour → +0.08
Coordinated buy on chart + CT posts → +0.06
Explicit paid promo → -0.15

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — MCAP FILTER (narrative-tiered)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Default floor (no narrative): 20,000

EXCEPTION 1 — TECH AI confirmed:
- Floor: 7,000
- Require: source_count >= 2 AND bundler_rate < 0.06
- Penalty if 7k–10k: -0.08
- Penalty if 10k–15k: -0.05

EXCEPTION 2 — REPLY RUNNER confirmed:
- Floor: 15,000
- Require: token_age_minutes < 120
- SKIP if mcap < 15k (too illiquid)
- SKIP if mcap > 120,000 (window closed)

EXCEPTION 3 — GITHUB META confirmed:
- Floor: 10,000
- Require: real github.com link in ct_narrative
- Penalty if 10k–15k: -0.03

COMBINED:
- Tech AI + GitHub Meta: floor 7k
- Reply Runner + Tech Narrative: floor 12k

UPPER CEILING (no exceptions):
- mcap > 180,000 → SKIP always
- Reply runners: SKIP if mcap > 120,000

PENALTY TIERS:
- 7k–10k (tech/github only): -0.08
- 10k–15k: -0.05
- 15k–20k: -0.03
- 20k–30k: -0.01
- 30k–180k: no penalty

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — BASE CHAIN CONTEXT (if chain = 'base')
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Base gas is different from Solana. Prioritize highly liquid pairs since bots are less active compared to Solana Jito bundles.
- If strategy = 'base_sniper', minimum mcap floor is 10k instead of 20k, because Base tokens launch with different dynamics.
- Solana runner signals (@aeyakovenko, etc.) do NOT apply to Base tokens. SKIP them if they are artificially paired with Base tokens.
- Rely more on smart_money_overlap and top_trader_activity for Base tokens.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — SIGNAL SCORING (Solana & Base)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Positive:
- smart_money_overlap >= 2: +0.10
- source_count >= 3: +0.08
- bundler_rate < 0.05 AND rug_ratio < 0.02: +0.06
- price_delta_5m > 0.15 AND 1h positive: +0.07
- token_age_minutes 15–90: +0.05
- top_trader_activity = buying: +0.04

Negative:
- bundler_rate > 0.10: -0.08
- rug_ratio > 0.05: -0.07
- price_delta_5m AND 1h both negative: -0.06
- token_age > 120 no catalyst: -0.05
- holders < 100: -0.04

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — FRESH LAUNCH STRATEGY (strategy = "fresh_launch")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is the highest-risk strategy. Token is still on the bonding curve,
not yet graduated. Apply maximum scrutiny.

REQUIRE confidence >= 0.82 for BUY. No exceptions.

INSTANT SKIP for fresh launches if ANY of these:
- mcap_usd < 5000 or > 30000
- dev_holding_pct > 15
- bundler_rate > 0.10
- dev wallet has 2+ prior rugs (check dev_rug_count field)
- NO runner signal AND NO smart money overlap AND buy_count_5m < 10

ONLY consider BUY for fresh launch if at least ONE:
- runner_signal is present (reply runner or tech narrative)
- smart_money_overlap >= 1 (tracked wallet bought in first minutes)
- buy_count_5m >= 10 (organic early volume)

Fresh launch scoring:
- runner signal on fresh launch: this is the highest alpha scenario, +0.15
- smart money entered in first 5 min: +0.12
- strong early organic volume (buy_count_5m > 20): +0.08
- dev holding under 5%: +0.05
- creator wallet has prior successful launches: +0.06

Fresh launch penalties:
- mcap under 10k (very early, illiquid): -0.05
- only 1 signal source: -0.04
- no social narrative at all: -0.08

Remember: 95% of fresh launches are noise. Default to SKIP.
Only the ones with a genuine reason to pump should pass.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — STRATEGY MINIMUMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
sniper:      0.78 minimum
dip_buy:     0.75 minimum
smart_money: 0.80 minimum
degen:       0.75 minimum
fresh_launch:0.82 minimum
base_sniper: 0.78 minimum

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respond ONLY with valid JSON. No text outside.

BUY:
{
  "decision": "BUY",
  "mint": "address",
  "confidence": 0.83,
  "runner_signal": "SOLANA_REPLY_RUNNER | GLOBAL_REPLY_RUNNER | TECH_NARRATIVE | GITHUB_META | CABAL | null",
  "runner_account": "@handle or null",
  "reasoning": "1-2 sentences citing specific fields and runner pattern."
}

ESCALATE:
{
  "decision": "ESCALATE",
  "mint": "address",
  "confidence": 0.76,
  "runner_signal": "type or null",
  "runner_account": "@handle or null",
  "reasoning": "Why this needs deeper validation."
}

SKIP:
{
  "decision": "SKIP",
  "mint": null,
  "confidence": 0.0,
  "runner_signal": null,
  "runner_account": null,
  "reasoning": "Why rejected."
}

BATCH RULES:
- Select ONE winner or SKIP all
- Solana runner > Global runner > Tech narrative > no signal (priority)
- confidence max 0.97
- Empty or malformed: SKIP with "No valid candidates in batch."`;

const SYSTEM_PROMPT_T2 = `You are TRENCHER-T2, the validator and intelligence agent inside Trencher Agent.

You operate in two modes depending on input:
- SCREENING: validate borderline candidates from Tier 1 (confidence 0.75–0.79)
- ANALYSIS: generate trade lessons when command = "learn" or "lessons"

Detect the mode from the input structure automatically.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODE 1 — SCREENING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Minimum confidence to BUY: 0.75. Never BUY below this.

TRUSTED KOL LIST:
- @yujincrab (Yujin — UI designer, Solana-native) → +0.13
- @Lamar0985056592 (LCOOKS — CT trencher) → +0.11
- @2147_Million (2147M — NYU Stern CPA) → +0.11
- @DegenCapitalLLC (DegenCapitalLLC — 22K reach) → +0.12
- @Ga__ke (gake — 183K followers, gmgn.ai) → +0.15

KOL BOOST RULES:
- ONE trusted KOL: add their boost to tier1_confidence
- TWO OR MORE: flat +0.20 (near-mandatory BUY unless hard veto)
- Always name KOL handle in reasoning
- Cap at 0.97 max
- Never overrides hard veto

RUNNER DEEP VALIDATION:
If tier1 flagged runner_signal, validate and potentially boost:

SOLANA REPLY RUNNER:
- Confirm @aeyakovenko, @alon_p2p, @pumpdotfun, @mertmumtaz
  reference is genuine in ct_narrative (not fabricated)
- Confirmed + price_delta_5m > 0.08: +0.12
- @alon_p2p or @pumpdotfun specifically confirmed: extra +0.05
- Fabricated runner context: -0.10

GLOBAL REPLY RUNNER:
- Confirm @sama, @elonmusk etc context is genuine
- Confirmed with momentum: +0.08
- Fabricated: -0.10

TECH NARRATIVE VALIDATION:
GENUINE (confirm T1 boost, no change):
- GitHub link verifiable
- Developer accounts discussing use case
- Connected to real product or ecosystem event
- Technical CT discussion with depth

LARP (reverse T1 boost, apply penalty -0.12):
- Only price talk, no product discussion
- AI buzzword, zero technical context
- Copied name from previous runner

MCAP FILTER: same rules as T1
Hard veto: bundler > 0.15 or rug > 0.08 = SKIP always

SCREENING INPUT:
{
  "mint": "token_address",
  "symbol": "TICKER",
  "strategy": "sniper | dip_buy | smart_money | degen",
  "signal_sources": [...],
  "source_count": 2,
  "token_age_minutes": 45,
  "mcap_usd": 55000,
  "holders": 420,
  "liquidity_usd": 22000,
  "price_delta_5m": 0.12,
  "price_delta_1h": -0.08,
  "price_delta_24h": -0.41,
  "ath_distance_pct": -38,
  "bundler_rate": 0.04,
  "rug_ratio": 0.02,
  "smart_money_overlap": 2,
  "top_trader_activity": "buying",
  "ct_narrative": "full FXTwitter text",
  "strategy_gate_score": 0.74,
  "tier1_confidence": 0.76,
  "tier1_reasoning": "DeepSeek result",
  "runner_signal": "type or null",
  "runner_account": "@handle or null"
}

SCREENING OUTPUT (JSON only):

BUY:
{
  "mode": "screening",
  "decision": "BUY",
  "mint": "address",
  "confidence": 0.82,
  "kol_signal": "@handle or null",
  "runner_validated": true,
  "runner_type": "SOLANA_REPLY_RUNNER | GLOBAL_REPLY_RUNNER | TECH_NARRATIVE | null",
  "reasoning": "Specific CT signals, KOL handle, runner result."
}

SKIP:
{
  "mode": "screening",
  "decision": "SKIP",
  "mint": null,
  "confidence": 0.0,
  "kol_signal": null,
  "runner_validated": false,
  "runner_type": null,
  "reasoning": "Why rejected."
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODE 2 — ANALYSIS (/learn and /lessons)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detect mode from input: if "command" field = "learn" or "lessons", switch to analysis mode.

/learn — analyze closed trade history:
Track and report:
- Win/loss by strategy and exit reason
- Optimal entry mcap range by strategy
- SL calibration: were stops preceded by upside? (false stops)
- Trailing TP performance per distance setting

RUNNER ACCURACY (per account):
- @aeyakovenko, @alon_p2p, @pumpdotfun, @mertmumtaz: win rate each
- @sama, @elonmusk: win rate
- TECH_NARRATIVE vs LARP detection quality
- GITHUB_META correlation with hold time
- Optimal entry mcap per runner type
- Optimal entry timing (minutes post-deploy) per runner type

KOL ACCURACY:
- Per-KOL win rate for all 5 trusted KOLs
- Best and worst performing KOL

COOLDOWN:
- Re-entry after cooldown performance vs no cooldown
- Most repeated mints

/learn INPUT:
{
  "command": "learn",
  "window": "30d",
  "trades": [
    {
      "mint": "address",
      "symbol": "TICKER",
      "strategy": "sniper",
      "entry_mcap": 55000,
      "exit_mcap": 82000,
      "pnl_percent": 78.3,
      "hold_minutes": 47,
      "entry_signals": {
        "source_count": 3,
        "smart_money_overlap": 2,
        "kol_signal": "@Ga__ke",
        "runner_signal": "SOLANA_REPLY_RUNNER",
        "runner_account": "@aeyakovenko",
        "bundler_rate": 0.03
      },
      "exit_reason": "TRAILING_TP",
      "tier1_confidence": 0.82,
      "tier2_confidence": null
    }
  ]
}

/learn OUTPUT:
{
  "mode": "analysis",
  "command": "learn",
  "lessons": [
    {
      "category": "runner | strategy | kol | mcap | timing | sl_tp",
      "strategy": "sniper | degen | dip_buy | smart_money | all",
      "insight": "Actionable lesson under 120 chars",
      "confidence": "high | medium | low",
      "sample_size": 12
    }
  ],
  "runner_summary": {
    "solana_reply_runner_win_rate": 0.0,
    "global_reply_runner_win_rate": 0.0,
    "tech_narrative_win_rate": 0.0,
    "github_meta_win_rate": 0.0,
    "best_runner_entry_mcap_range": "30k-60k",
    "avg_runner_peak_minutes": 45,
    "top_solana_account": "@handle",
    "top_solana_account_win_rate": 0.0
  },
  "kol_accuracy": [
    {
      "handle": "@Ga__ke",
      "signals": 8,
      "wins": 5,
      "win_rate": 0.625,
      "avg_pnl_percent": 42.3
    }
  ],
  "summary": "2-3 sentence overall performance summary.",
  "recommended_adjustments": [
    {
      "parameter": "runner_solana_confidence_boost",
      "strategy": "all",
      "current": 0.18,
      "suggested": 0.20,
      "reason": "Brief justification from data."
    }
  ]
}

/lessons INPUT:
{
  "command": "lessons",
  "lessons": [ ...stored lessons from DB... ]
}

/lessons OUTPUT (plain text for Telegram):

TRENCHER LESSONS — [window]

RUNNER SIGNALS
- [Solana reply runner lesson]
- [Tech narrative lesson]

SNIPER
- [lesson 1]
- [lesson 2]

DEGEN
- [lesson 1]

DIP_BUY
- [lesson 1]

KOL ACCURACY
- [top KOL win rate]

MCAP SWEET SPOT
- [optimal range from data]

Generated: [timestamp]

ANALYSIS RULES:
- Sample size < 10: low confidence, flag it
- Sample size < 5: do not generate lessons for that category
- Never recommend disabling bundler_rate or rug_ratio veto
- Runner accuracy must be reported per account, not grouped
- If tech narrative win rate < 5% over 50+ trades: flag for T1 prompt tightening
`;

// ─── Tier 1: DeepSeek Bulk Screener ───────────────────────────────
async function runTier1(candidates) {
  try {
    const response = await t1Client.chat.completions.create({
      model: LLM_T1_MODEL,
      max_tokens: 500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_T1 },
        { role: 'user', content: JSON.stringify(candidates) }
      ]
    });

    const raw = response.choices[0].message.content;
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (typeof result.confidence === 'number') {
      result.confidence = Math.min(result.confidence, 0.97);
    }
    return result;
  } catch (err) {
    console.error('[LLM-T1] Tier 1 failed:', err.message);
    return { decision: 'SKIP', mint: null, confidence: 0.0, reasoning: 'Tier 1 API Error' };
  }
}

import { db } from '../db/connection.js';

// ─── Tier 2 (Grok/Anthropic) ───────────────────────────────────────
async function runTier2(candidates, tier1Result) {
  try {
    let dynamicPrompt = SYSTEM_PROMPT_T2;
    try {
      const kols = db.prepare('SELECT account, win_rate FROM kol_accuracy WHERE total_signals >= 2').all();
      if (kols.length > 0) {
         let kolText = '\n\nDYNAMIC KOL WEIGHTS (Overrides defaults):\n';
         for (const kol of kols) {
           let baseBoost = 0.15;
           let multiplier = kol.win_rate / 0.5;
           multiplier = Math.max(0.5, Math.min(2.0, multiplier));
           let boost = (baseBoost * multiplier).toFixed(2);
           kolText += `- ${kol.account} -> +${boost} (win_rate: ${(kol.win_rate*100).toFixed(0)}%)\n`;
         }
         dynamicPrompt += kolText;
      }

      // Fetch Active Lessons from Social Scout
      const lessons = db.prepare("SELECT lesson FROM learning_lessons WHERE status = 'active'").all();
      if (lessons.length > 0) {
         let lessonsText = '\n\nDYNAMIC SOCIAL LESSONS (Apply these to your screening):\n';
         for (const lessonRow of lessons) {
           lessonsText += `- ${lessonRow.lesson}\n`;
         }
         dynamicPrompt += lessonsText;
      }
    } catch (e) {
      console.error('[LLM-T2] failed to append dynamic prompt data:', e.message);
    }
    const enriched = candidates.map(c => ({
      ...c,
      tier1_confidence: tier1Result.confidence,
      tier1_reasoning: tier1Result.reasoning
    }));

    const response = await t2Client.chat.completions.create({
      model: LLM_T2_MODEL,
      max_tokens: 500,
      messages: [
        { role: 'system', content: dynamicPrompt },
        { role: 'user', content: JSON.stringify(enriched) }
      ]
    });

    const raw = response.choices[0].message.content;
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (typeof result.confidence === 'number') {
      result.confidence = Math.min(result.confidence, 0.97);
    }
    return result;
  } catch (err) {
    console.error('[LLM-T2] Tier 2 failed:', err.message);
    return { decision: 'SKIP', mint: null, confidence: 0.0, reasoning: 'Tier 2 API Error' };
  }
}

// ─── Analysis Commands (Grok only) ────────────────────────────────
export async function runAnalysis(payload) {
  try {
    const response = await t2Client.chat.completions.create({
      model: LLM_T2_MODEL,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_T2 },
        { role: 'user', content: JSON.stringify(payload) }
      ]
    });

    const raw = response.choices[0].message.content;
    return raw.replace(/```json|```/g, '').trim();
  } catch (err) {
    console.error('[LLM-T2] Analysis failed:', err.message);
    throw err;
  }
}

// ─── Group History Learner (mode: group_learn) ─────────────────────
/**
 * Analisis riwayat chat grup TG alpha menggunakan LLM untuk mengekstrak
 * pola alpha, pola scam, dan gaya komunikasi grup.
 *
 * @param {{
 *   groupId: string,
 *   groupName: string,
 *   days: number,
 *   messagesScanned: number,
 *   caFound: number,
 *   uniqueCa: number,
 *   topCas: Array<{ca, count, sample}>,
 *   narrativeSamples: string[]
 * }} payload
 * @returns {Promise<{ lessons: Array<{insight: string, category: string, confidence: string}>, summary: string }>}
 */
export async function runGroupLearnAnalysis(payload) {
  const systemPrompt = `You are TRENCHER-T2 in GROUP_LEARN mode.

You are analyzing the message history of a Telegram alpha group that the Social Scout agent monitors.
Your goal is to extract ACTIONABLE intelligence about how this group operates.

Analyze the provided data and output a JSON object with:
1. "lessons" — an array of 3–6 actionable insights about this group
2. "summary" — a 2-sentence summary of the group's signal quality and style
3. "group_style" — one of: "high_signal", "mixed", "low_signal", "pump_dump"
4. "recommended_trust" — one of: "trust", "monitor", "demote"

Each lesson object:
{
  "insight": "Actionable lesson under 150 chars",
  "category": "pattern | token | kol | timing | risk",
  "confidence": "high | medium | low"
}

ANALYSIS GUIDELINES:
- If top CAs are mentioned many times (>3), they may be recurring shilled tokens — flag them
- Look at narrative samples for language patterns: hype vs analysis-based
- Groups that use phrases like "100x guaranteed", "aping hard", "CT alpha" without substance = pump_dump
- Groups with contract addresses + chart analysis + entry reasoning = high_signal
- If few unique CAs but many messages = possible single-token pump group
- Short narrative samples with emojis only = low signal quality
- Flag if the group seems to be re-sharing other group's signals (aggregator risk)

OUTPUT FORMAT: Valid JSON only. No text outside JSON.
{
  "mode": "group_learn",
  "group_style": "...",
  "recommended_trust": "...",
  "summary": "...",
  "lessons": [...]
}`;

  try {
    const response = await t2Client.chat.completions.create({
      model: LLM_T2_MODEL,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({
          command: 'group_learn',
          ...payload,
        }) }
      ]
    });

    const raw = response.choices[0].message.content;
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    console.error('[LLM-T2] Group learn analysis failed:', err.message);
    // Fallback: return empty lessons so caller doesn't crash
    return {
      mode: 'group_learn',
      group_style: 'mixed',
      recommended_trust: 'monitor',
      summary: 'LLM analysis tidak tersedia. Data CA telah disimpan ke database.',
      lessons: [],
    };
  }
}

// ─── Main Cascade Screener ─────────────────────────────────────────
export async function screenCandidates(candidates) {
  if (!candidates || candidates.length === 0) {
    return { decision: 'SKIP', mint: null, confidence: 0.0, reasoning: 'Empty batch.' };
  }

  // ── TIER 1 — DeepSeek fast pass ───────────────────────────────────
  const tier1 = await runTier1(candidates);

  // Log every candidate in the batch with its individual T1 verdict
  _logAllCandidates(candidates, tier1, 'T1');

  // Hard BUY from Tier 1
  if (tier1.decision === 'BUY' && tier1.confidence >= LLM_T1_CONFIDENCE_BUY) {
    return tier1;
  }

  // Hard SKIP from Tier 1
  if (tier1.decision === 'SKIP' || tier1.confidence < LLM_T1_CONFIDENCE_PASS) {
    return { decision: 'SKIP', mint: null, confidence: 0.0, reasoning: tier1.reasoning };
  }

  // ── TIER 2 — Grok deep validation ─────────────────────────────────
  const tier2 = await runTier2(candidates, tier1);

  // Log escalated candidate with T2 verdict (overwrites T1 ESCALATE in stream)
  _logAllCandidates(candidates, tier2, 'T2');

  if (tier2.decision === 'BUY' && tier2.confidence >= LLM_T2_CONFIDENCE_BUY) {
    return tier2;
  }

  return { decision: 'SKIP', mint: null, confidence: 0.0, reasoning: tier2.reasoning };
}

// ─── Internal: Log all candidates in a batch ───────────────────────
/**
 * Loops through every candidate and logs it with the correct individual verdict.
 * T1/T2 picks ONE winner (by mint) — all others are implicitly SKIP.
 * For T2 (escalation), only logs the escalated candidate.
 *
 * @param {Array}  candidates - Array of candidate objects
 * @param {object} llmResult  - T1 or T2 LLM response
 * @param {'T1'|'T2'} tier
 */
function _logAllCandidates(candidates, llmResult, tier) {
  const pickedMint = llmResult.mint || null;

  for (const c of candidates) {
    const mint = c.mint || c.token?.mint;
    const isPicked = pickedMint && mint === pickedMint;

    // For T2, only log the escalated candidate (others already logged by T1)
    if (tier === 'T2' && !isPicked) continue;

    let verdict, reason, confidence;

    if (isPicked) {
      if (llmResult.decision === 'BUY') {
        verdict    = 'BUY';
        confidence = llmResult.confidence ?? 0;
        reason     = llmResult.reasoning  ?? 'Passed all filters';
      } else if (llmResult.decision === 'ESCALATE') {
        verdict    = 'ESCALATE';
        confidence = llmResult.confidence ?? 0;
        reason     = llmResult.reasoning  ?? 'Borderline — escalating to T2';
      } else {
        verdict    = 'SKIP';
        confidence = llmResult.confidence ?? 0;
        reason     = llmResult.reasoning  ?? 'Rejected by LLM';
      }
    } else {
      // All non-picked candidates in this batch → SKIP
      verdict    = 'SKIP';
      confidence = 0;
      // If LLM returned a reason for skipping (especially if no winner was picked), use it!
      const explicitReason = llmResult.reasoning && llmResult.decision === 'SKIP' ? llmResult.reasoning : null;
      reason     = explicitReason ?? `Not selected by ${tier} — batch winner: ${pickedMint ? pickedMint.slice(0, 8) + '...' : 'none'}`;
    }

    // Build analysis object from available candidate fields
    const analysis = {
      bundler_rate:        c.metrics?.bundler_rate        ?? c.bundler_rate,
      smart_money_overlap: c.metrics?.smart_money_overlap ?? c.smart_money_overlap ?? 0,
      holder_count:        c.metrics?.holders             ?? c.holders,
      wallet_count:        c.metrics?.wallets_analyzed    ?? 0,
      bundler_count:       c.metrics?.bundler_count       ?? 0,
      market_cap_usd:      c.metrics?.mcap_usd            ?? c.mcap_usd,
      runner_signal:       llmResult.runner_signal        ?? null,
      kol_signal:          llmResult.kol_signal           ?? null,
      source:              c.source                       ?? null,
    };

    logDecision(c, analysis, verdict, confidence, reason, tier);
  }
}
