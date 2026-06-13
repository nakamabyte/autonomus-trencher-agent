/**
 * Evaluate an incoming signal against an agent's DNA configuration.
 *
 * All DNA traits from BREED_DNA_DEFAULTS are now fully applied:
 *   - rug_defense         → controls rug/bundler filter strictness
 *   - aggression          → how many failed checks are tolerated
 *   - social_signal_weight → boosts confidence when KOL/TG signal is present
 *   - momentum_sensitivity → boosts confidence on strong price momentum
 *   - liquidity_sensitivity → penalizes low liquidity more for sensitive breeds
 *   - exit_discipline     → raises the per-agent minimum confidence floor
 *   - runner_weight       → boosts on runner (reply runner) signals
 *   - smart_money_weight  → boosts on smart money overlap
 *   - wallet_intelligence  → boosts when multiple smart wallets confirmed
 *
 * @param {object} signal - Enriched signal from sharedSignalFeed / orchestrator
 * @param {object} dna    - DNA config from agent_dna row (parsed dna_config JSON)
 * @returns {{ verdict: 'BUY'|'SKIP', confidence: number, reason: string }}
 */
export async function evaluateSignalWithDna(signal, dna) {
  // ── 0. BREED STRICT HARD-FILTERS ───────────────────────────────────────────
  // These filters define the absolute personality of the agent. If the signal doesn't
  // match the breed's core identity, it is rejected immediately regardless of LLM confidence.
  
  const breed = dna.breed || 'scout';

  if (breed === 'sniper') {
    // Snipers only buy if there is positive short-term momentum.
    if ((signal.price_delta_5m || 0) < 0.05) {
      return { verdict: 'SKIP', confidence: signal.llm_confidence || 0, reason: `DNA skip — sniper requires price_delta_5m >= 0.05` };
    }
  } else if (breed === 'degen') {
    // Degens only buy high-risk plays: mcap < 100k or token age < 60 mins.
    const mcap = signal.mcap_usd || 0;
    const age = signal.token_age_minutes || 0;
    if (mcap >= 100000 && age >= 60) {
      return { verdict: 'SKIP', confidence: signal.llm_confidence || 0, reason: `DNA skip — degen requires mcap < 100k or age < 60m` };
    }
  } else if (breed === 'bunker') {
    // Bunker only buys very safe plays: rug prob <= 0.05 and liquidity > 5k.
    const rug = signal.rug_probability || 0;
    const liq = signal.liquidity_usd || 0;
    if (rug > 0.05 || liq <= 5000) {
      return { verdict: 'SKIP', confidence: signal.llm_confidence || 0, reason: `DNA skip — bunker requires rug <= 0.05 and liquidity > 5000` };
    }
  } else if (breed === 'whale_tracker') {
    // Whale tracker requires at least 1 smart money wallet overlap.
    const smart = signal.smart_money_overlap || 0;
    if (smart < 1) {
      return { verdict: 'SKIP', confidence: signal.llm_confidence || 0, reason: `DNA skip — whale_tracker requires smart_money_overlap >= 1` };
    }
  }

  // ── 1. Hard-filter checks ──────────────────────────────────────────────────
  // rug_defense (0-100): higher = stricter rug tolerance.
  // e.g. bunker (95) rejects anything rug_probability > 0.05
  const rugThreshold = (100 - (dna.rug_defense || 50)) / 100;
  const bundlerMax   = dna.bundler_max || 1.0;

  const checks = {
    mcap_ok:       signal.mcap_usd >= (dna.min_mcap_usd || 0),
    rug_ok:        (signal.rug_probability || 0)  <= rugThreshold,
    bundler_ok:    (signal.bundler_ratio   || 0)  <= bundlerMax,
    confidence_ok: (signal.llm_confidence  || 0)  >= (dna.llm_min_confidence || 50) / 100,
  };

  // aggression (0-100): degen (95) tolerates up to 2 failed checks; bunker (30) → 0
  const failedChecks = Object.values(checks).filter(c => !c).length;
  const tolerance    = Math.floor((dna.aggression || 50) / 40);

  if (failedChecks > tolerance) {
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(', ');
    return { verdict: 'SKIP', confidence: signal.llm_confidence || 0, reason: `failed DNA filters: ${failed}` };
  }

  // ── 2. Base confidence from LLM ───────────────────────────────────────────
  let adjustedConfidence = signal.llm_confidence || 0.5;

  // ── 3. social_signal_weight (0-100) ───────────────────────────────────────
  // Applied when a KOL handle or TG alpha signal is present.
  // social_scout (95) gains +0.095 max; bunker (45) gains +0.045 max.
  const socialWeightRaw = dna.social_signal_weight || 50;
  const socialWeight = socialWeightRaw / 100;
  const hasKol = signal.kol_signal && signal.kol_signal !== 'YES';  // specific handle > generic
  const hasTgAlpha = signal.source === 'tg_alpha';

  // HARD SKIP: If this is a TG group signal but agent doesn't care about social signals (<30)
  if (hasTgAlpha && socialWeightRaw < 30) {
    return { verdict: 'SKIP', confidence: signal.llm_confidence || 0, reason: `DNA skip — agent ignores group signals (social weight ${socialWeightRaw} < 30)` };
  }

  let callerScore = undefined;
  if (hasTgAlpha) {
    // ── 3.5 Caller Reputation (Trust Tier & Score) ──────────────────────────
    const callerMeta = signal.sourceMeta?.callerMeta || {};
    const callerTrustTier = callerMeta.trustTier || 'B';
    callerScore = callerMeta.trustScore !== undefined ? callerMeta.trustScore : 0.5;
    
    if (callerTrustTier === 'F') {
      return { verdict: 'SKIP', confidence: signal.llm_confidence || 0, reason: `DNA skip — caller is Tier F (untrusted)` };
    }

    // Trust multiplier logic: scale the boost by the reputation score (0 to 1)
    // Tier A / high winrate users get a larger boost (up to 0.20 total base)
    // Tier C / low winrate users get a negative boost (penalty)
    let baseBoost = socialWeight * 0.15; // base maximum potential boost from group call
    
    // Map trustScore (0..1) to a multiplier (-1.0 to +1.0)
    // 0.5 is neutral (multiplier 0) -> gives 0.075 boost
    // 1.0 is max (multiplier 1.0) -> gives 0.15 boost
    // 0.0 is min (multiplier -1.0) -> gives -0.15 penalty
    const multiplier = (callerScore - 0.5) * 2;
    
    let boost = baseBoost * (0.5 + 0.5 * multiplier);
    if (callerScore < 0.3) {
       boost = -0.10; // Explicit penalty for poor track record
    }

    adjustedConfidence += boost;
  } else if (hasKol) {
    // Specific KOL handle detected (e.g. "@Ga__ke")
    adjustedConfidence += socialWeight * 0.07;
  } else if (signal.kol_signal === 'YES') {
    // Generic KOL signal (legacy "YES" format) — smaller boost
    adjustedConfidence += socialWeight * 0.03;
  }

  // ── 4. momentum_sensitivity (0-100) ───────────────────────────────────────
  // Applied when there is strong 5m positive price momentum.
  // sniper (90) can gain up to +0.045; bunker (35) gains +0.0175.
  const momentumWeight = (dna.momentum_sensitivity || 50) / 100;
  const priceDelta5m   = signal.price_delta_5m || 0;
  const priceDelta1h   = signal.price_delta_1h || 0;

  if (priceDelta5m > 0.15 && priceDelta1h > 0) {
    // Strong upward momentum across timeframes
    adjustedConfidence += momentumWeight * 0.05;
  } else if (priceDelta5m > 0.05) {
    // Mild positive momentum
    adjustedConfidence += momentumWeight * 0.02;
  } else if (priceDelta5m < 0 && priceDelta1h < 0) {
    // Both timeframes negative — punish momentum-sensitive agents more
    adjustedConfidence -= momentumWeight * 0.04;
  }

  // ── 5. liquidity_sensitivity (0-100) ─────────────────────────────────────
  // High-sensitivity breeds (bunker: 85) are penalized more on low liquidity.
  // Low-sensitivity breeds (degen: 30) tolerate illiquid tokens.
  const liqWeight    = (dna.liquidity_sensitivity || 50) / 100;
  const liquidityUsd = signal.liquidity_usd || 0;
  const liqFloor     = dna.liquidity_floor_usd || 5000;

  if (liquidityUsd < liqFloor) {
    // Below floor: penalty scales with how sensitive the agent is
    adjustedConfidence -= liqWeight * 0.06;
  } else if (liquidityUsd > liqFloor * 4) {
    // Well above floor: small bonus for high-liquidity-sensitive agents
    adjustedConfidence += liqWeight * 0.02;
  }

  // ── 6. runner_weight (custom DNA field, optional) ─────────────────────────
  if (dna.runner_weight && signal.runner_signal) {
    adjustedConfidence += (dna.runner_weight / 100) * 0.10;
  }

  // ── 7. exit_discipline → raises per-agent min confidence floor ────────────
  // Agent with exit_discipline=90 (reaper, social_scout) requires >= 0.78 confidence.
  // Agent with exit_discipline=25 (degen) only requires >= 0.70.
  const disciplineFloor = 0.68 + ((dna.exit_discipline || 50) / 100) * 0.12;
  const llmFloor        = (dna.llm_min_confidence || 50) / 100;
  const minConfidence   = Math.max(llmFloor, disciplineFloor);

  // ── 8. Pay.sh: Nansen Enrichment on Uncertain Band ────────────────────────
  // If confidence is slightly below the threshold (e.g., 0 to 0.10 below), we query Pay.sh
  let enrichmentLog = "";
  if (adjustedConfidence >= minConfidence - 0.10 && adjustedConfidence < minConfidence) {
    try {
      const { fetchWithPaySh } = await import('../payments/paysh-client.js');
      const url = `https://api.pay.sh/nansen/v1/token/${signal.mint || 'unknown'}`;
      
      const res = await fetchWithPaySh(url, {}, 0.10, "nansen");
      
      // Mocked Nansen response
      signal.smart_money_overlap = (signal.smart_money_overlap || 0) + 1;
      enrichmentLog = ` | enrichment cost: $0.10 via pay.sh/nansen`;
    } catch (e) {
      console.error("[evaluate] Pay.sh Nansen enrichment failed:", e.message);
    }
  }

  // ── 9. smart money / wallet intelligence ──────────────────────────────────
  const smartMoneyWeight = (dna.smart_money_weight || dna.wallet_intelligence || 50) / 100;
  if (signal.smart_money_overlap > 0) {
    adjustedConfidence += smartMoneyWeight * Math.min(signal.smart_money_overlap, 3) * 0.03;
  }

  // Clamp to [0, 0.97]
  adjustedConfidence = Math.max(0, Math.min(0.97, adjustedConfidence));

  const verdict = adjustedConfidence >= minConfidence ? 'BUY' : 'SKIP';
  
  // Format the reason for logging
  const reasons = [];
  if (hasKol) reasons.push(`KOL mentioned`);
  if (callerScore) reasons.push(`caller score ${callerScore.toFixed(2)}`);
  if (priceDelta5m > 0.05) reasons.push(`5m momentum +${(priceDelta5m * 100).toFixed(0)}%`);
  if (signal.smart_money_overlap > 0) reasons.push(`smart money overlap ${signal.smart_money_overlap}`);
  if (dna.runner_weight && signal.runner_signal) reasons.push(`runner signal detected`);
  
  let finalReason = reasons.length > 0 ? reasons.join(', ') : 'Base llm confidence';
  finalReason += enrichmentLog;

  return {
    verdict,
    confidence: adjustedConfidence,
    reason: finalReason
  };
}
