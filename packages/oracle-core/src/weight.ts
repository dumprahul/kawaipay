import {
  type CapLimits,
  type CapUsage,
  type IpClass,
  type LinkRiskState,
  TICK_SECONDS,
  WARMUP_FACTOR,
  WARMUP_HOURS,
} from "./types.js";

export const WEIGHT_REASON = {
  LINK_HOLD: "LINK_HOLD",
  LINK_HOURLY_CAP: "LINK_HOURLY_CAP",
  SOURCE_HOURLY_CAP: "SOURCE_HOURLY_CAP",
} as const;

const WARMUP_WINDOW_MS = WARMUP_HOURS * 3600 * 1000;

/** warmup: 0.5 for the first 24h after the link's first tick, else 1.0. */
export function computeWarmup(nowMs: number, linkFirstTickMs: number): number {
  const elapsed = nowMs - linkFirstTickMs;
  return elapsed < WARMUP_WINDOW_MS ? WARMUP_FACTOR : 1.0;
}

/** sessionDecay: 1.0 up to 600s, falls linearly to 0.2 at 2400s, never below 0.2. */
export function computeSessionDecay(sessionSecondsPaid: number): number {
  if (sessionSecondsPaid <= 600) return 1.0;
  if (sessionSecondsPaid >= 2400) return 0.2;
  const t = (sessionSecondsPaid - 600) / (2400 - 600);
  return 1.0 - 0.8 * t;
}

export interface FinalWeightResult {
  weight: number;
  weightBp: number;
  reasons: string[];
}

/** Step 4: final weight and basis points (spec section 7). */
export function computeFinalWeight(
  verdictWeight: number,
  linkRisk: LinkRiskState,
  sessionDecay: number,
  warmup: number,
): FinalWeightResult {
  const reasons: string[] = [];
  let weight = verdictWeight * linkRisk.weightMultiplier * sessionDecay * warmup;
  if (linkRisk.hold) {
    weight = 0;
    reasons.push(WEIGHT_REASON.LINK_HOLD);
  }
  const weightBp = Math.round(weight * 10000);
  return { weight, weightBp, reasons };
}

/** Step 4 (continued): amount from rate and basis points. Integer math only. */
export function computeAmount(ratePerSecond: number, weightBp: number): number {
  return Math.floor((ratePerSecond * TICK_SECONDS * weightBp) / 10000);
}

export interface CapResult {
  amount: number;
  reasons: string[];
}

/**
 * Step 5: hourly caps (spec section 7). Caller is responsible for atomically reading
 * and incrementing the underlying counters (Redis in production) — this function is a
 * pure calculation over the usage snapshot handed to it.
 */
export function applyCaps(
  amount: number,
  usage: CapUsage,
  limits: CapLimits,
  ipClass: IpClass,
): CapResult {
  const reasons: string[] = [];
  let capped = amount;

  const linkRemaining = Math.max(0, limits.linkHourlyCap - usage.linkHourlyEarned);
  if (capped > linkRemaining) {
    capped = linkRemaining;
    reasons.push(WEIGHT_REASON.LINK_HOURLY_CAP);
  }

  const sourceMultiplier = ipClass === "tor" || ipClass === "datacenter" ? 0.25 : 1;
  const sourceLimit = limits.sourceHourlyCap * sourceMultiplier;
  const sourceRemaining = Math.max(0, sourceLimit - usage.sourceHourlyEarned);
  if (capped > sourceRemaining) {
    capped = sourceRemaining;
    reasons.push(WEIGHT_REASON.SOURCE_HOURLY_CAP);
  }

  return { amount: capped, reasons };
}
