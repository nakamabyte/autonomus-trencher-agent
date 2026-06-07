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
  const socialWeight = (dna.social_signal_weight || 50) / 100;
  const hasKol = signal.kol_signal && signal.kol_signal !== 'YES';  // specific handle > generic
  const hasTgAlpha = signal.source === 'tg_alpha';

  if (hasTgAlpha) {
    // Human-curated TG alpha: full social weight boost
    adjustedConfidence += socialWeight * 0.10;
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

  // ── 7. smart money / wallet intelligence ──────────────────────────────────
  const smartMoneyWeight = (dna.smart_money_weight || dna.wallet_intelligence || 50) / 100;
  if (signal.smart_money_overlap > 0) {
    adjustedConfidence += smartMoneyWeight * Math.min(signal.smart_money_overlap, 3) * 0.03;
  }

  // ── 8. exit_discipline → raises per-agent min confidence floor ────────────
  // Agent with exit_discipline=90 (reaper, social_scout) requires >= 0.78 confidence.
  // Agent with exit_discipline=25 (degen) only requires >= 0.70.
  const disciplineFloor = 0.68 + ((dna.exit_discipline || 50) / 100) * 0.12;
  const llmFloor        = (dna.llm_min_confidence || 50) / 100;
  const minConfidence   = Math.max(llmFloor, disciplineFloor);

  // Clamp to [0, 0.97]
  adjustedConfidence = Math.max(0, Math.min(0.97, adjustedConfidence));

  const verdict = adjustedConfidence >= minConfidence ? 'BUY' : 'SKIP';
  const reason  = verdict === 'BUY'
    ? `DNA passed — adjusted confidence ${adjustedConfidence.toFixed(3)} >= floor ${minConfidence.toFixed(3)}`
    : `DNA skip — confidence ${adjustedConfidence.toFixed(3)} < floor ${minConfidence.toFixed(3)}`;

  return { verdict, confidence: adjustedConfidence, reason };
}

