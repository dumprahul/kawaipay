import { computeBaseScore, computePenalties, computeScore, computeVerdict } from "./scorer.js";
import { applyCaps, computeAmount, computeFinalWeight, computeSessionDecay, computeWarmup } from "./weight.js";
import {
  DEFAULT_CAP_LIMITS,
  SCORER_VERSION,
  type CapLimits,
  type CapUsage,
  type TickResult,
  type TickScoringInput,
} from "./types.js";

export * from "./types.js";
export * from "./scorer.js";
export * from "./weight.js";
export * from "./signer.js";
export * from "./attestation.js";

/**
 * Runs the full five-step pipeline from spec section 7 on one tick.
 * Pure function: same inputs always produce the same TickResult.
 */
export function scoreTick(
  input: TickScoringInput,
  capUsage: CapUsage,
  capLimits: CapLimits = DEFAULT_CAP_LIMITS,
): TickResult {
  const { stats, serverGapMs, history, ipClass, sessionSecondsPaid, linkRisk, ratePerSecond, linkFirstTickMs, nowMs } =
    input;

  const base = computeBaseScore(stats, history);
  const penalties = computePenalties(stats, serverGapMs, history);
  const scored = computeScore(base.base, penalties, base.visibleRatio, ipClass);
  const verdict = computeVerdict(scored.score);

  const warmup = computeWarmup(nowMs, linkFirstTickMs);
  const sessionDecay = computeSessionDecay(sessionSecondsPaid);
  const finalWeight = computeFinalWeight(verdict.verdictWeight, linkRisk, sessionDecay, warmup);

  const rawAmount = computeAmount(ratePerSecond, finalWeight.weightBp);
  const capped = applyCaps(rawAmount, capUsage, capLimits, ipClass);

  const reasons = [...scored.reasons, ...finalWeight.reasons, ...capped.reasons].sort();

  return {
    score: scored.score,
    verdict: verdict.verdict,
    weightBp: finalWeight.weightBp,
    amount: capped.amount,
    reasons,
    scorerVersion: SCORER_VERSION,
  };
}
