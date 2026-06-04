export async function evaluateSignalWithDna(signal, dna) {
  // Apply DNA-specific filters
  const checks = {
    mcap_ok: signal.mcap_usd >= (dna.min_mcap_usd || 0),
    rug_ok: (signal.rug_probability || 0) <= (100 - (dna.rug_defense || 50)) / 100,
    bundler_ok: (signal.bundler_ratio || 0) <= (dna.bundler_max || 1.0),
    confidence_ok: (signal.llm_confidence || 0) >= (dna.llm_min_confidence || 50) / 100,
  };

  // Aggression affects how many filters can fail
  const failedChecks = Object.values(checks).filter(c => !c).length;
  const tolerance = Math.floor((dna.aggression || 50) / 40);  // degen is more tolerant

  if (failedChecks > tolerance) {
    return { verdict: 'SKIP', confidence: signal.llm_confidence, reason: 'failed DNA filters' };
  }

  // Entry style affects runner/momentum/smart money weighting
  let adjustedConfidence = signal.llm_confidence || 0.5;
  if (dna.runner_weight && signal.runner_signal) {
    adjustedConfidence += dna.runner_weight * 0.1;
  }
  if (dna.smart_money_weight && signal.smart_money_overlap > 0) {
    adjustedConfidence += dna.smart_money_weight * 0.1;
  }

  const minConfidenceTarget = (dna.llm_min_confidence || 50) / 100;

  return {
    verdict: adjustedConfidence >= minConfidenceTarget ? 'BUY' : 'SKIP',
    confidence: adjustedConfidence,
    reason: 'DNA evaluation',
  };
}
