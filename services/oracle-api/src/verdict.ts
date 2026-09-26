import {
  bucketStats,
  DEFAULT_CAP_LIMITS,
  SCORER_VERSION,
  TICK_SECONDS,
  WARMUP_HOURS,
  type HistoryTick,
  type IpClass,
  type OracleVerdictRequest,
} from "@kawaipay/shared";
import { scoreTick, type TickScoringInput } from "@kawaipay/oracle-core";

export interface TickVerdict {
  score: number;
  verdict: string;
  weightBp: number;
  reasons: string[];
}

export interface OracleVerdictResponse {
  scorerVersion: string;
  results: TickVerdict[];
}

/**
 * Runs the real oracle-core scoring pipeline over a caller-supplied sequence of ticks —
 * the paid product this endpoint sells (spec section 12). There's no real link/campaign
 * behind this call, so a few of `scoreTick`'s inputs are given neutral stand-ins rather
 * than left to guesswork:
 *  - ratePerSecond is 0, so `amount` (a real payout in base units) is always 0 and is
 *    dropped from the response entirely — it would be meaningless outside a real
 *    campaign's own rate, and returning a fabricated number here would be misleading.
 *  - linkRisk is neutral (no hold, no multiplier) and the link is treated as already past
 *    its warm-up window — this way the response reflects only the submitted behavior
 *    itself, not warm-up/risk state a synthetic "link" can't meaningfully have.
 *  - sessionSecondsPaid accumulates tick-by-tick across the submitted array, and
 *    linkFirstTickMs/nowMs are both set far enough in the past to guarantee no warm-up
 *    dampening, so only the behavioral penalties (gap regularity, stats repetition, IP
 *    class, etc.) actually move the score.
 */
export function scoreVerdictRequest(request: OracleVerdictRequest, nowMs: number): OracleVerdictResponse {
  const linkFirstTickMs = nowMs - (WARMUP_HOURS + 1) * 3600 * 1000;
  const history: HistoryTick[] = [];
  const results: TickVerdict[] = [];
  let sessionSecondsPaid = 0;
  let tickNowMs = nowMs;

  for (const tick of request.ticks) {
    const bucketed = bucketStats(tick.stats);
    const input: TickScoringInput = {
      stats: bucketed,
      serverGapMs: tick.gapMs,
      history,
      ipClass: request.ipClass as IpClass,
      sessionSecondsPaid,
      linkRisk: { weightMultiplier: 1, hold: false },
      ratePerSecond: 0,
      linkFirstTickMs,
      nowMs: tickNowMs,
    };
    const result = scoreTick(input, { linkHourlyEarned: 0, sourceHourlyEarned: 0 }, DEFAULT_CAP_LIMITS);

    results.push({ score: result.score, verdict: result.verdict, weightBp: result.weightBp, reasons: result.reasons });
    history.push({ stats: bucketed, gapMs: tick.gapMs, score: result.score });
    sessionSecondsPaid += TICK_SECONDS;
    tickNowMs += TICK_SECONDS * 1000;
  }

  return { scorerVersion: SCORER_VERSION, results };
}
