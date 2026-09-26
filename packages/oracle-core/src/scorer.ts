import type { BucketedStats, HistoryTick, Verdict } from "./types.js";

export const REASON = {
  GAP_OUT_OF_RANGE: "GAP_OUT_OF_RANGE",
  GAP_TOO_REGULAR: "GAP_TOO_REGULAR",
  STATS_REPEATING: "STATS_REPEATING",
  NO_INTERACTION_LONG: "NO_INTERACTION_LONG",
  IMPOSSIBLE_SCROLL: "IMPOSSIBLE_SCROLL",
  IP_DATACENTER: "IP_DATACENTER",
  IP_TOR: "IP_TOR",
  HIDDEN: "HIDDEN",
} as const;

const PENALTY = {
  GAP_OUT_OF_RANGE: 0.3,
  GAP_TOO_REGULAR: 0.3,
  STATS_REPEATING: 0.4,
  NO_INTERACTION_LONG: 0.15,
  IMPOSSIBLE_SCROLL: 0.3,
  IP_DATACENTER: 0.3,
  IP_TOR: 0.2,
} as const;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function isInteractive(s: BucketedStats): boolean {
  return s.scrollEvents > 0 || s.pointerMoves > 0 || s.touchEvents > 0 || s.keyEvents > 0;
}

function statsEqualExceptWindowMs(a: BucketedStats, b: BucketedStats): boolean {
  return (
    a.visibleMs === b.visibleMs &&
    a.focusedMs === b.focusedMs &&
    a.inViewportMs === b.inViewportMs &&
    a.cvrPct === b.cvrPct &&
    a.scrollEvents === b.scrollEvents &&
    a.scrollDepthPct === b.scrollDepthPct &&
    a.scrollSpeedMax === b.scrollSpeedMax &&
    a.pointerMoves === b.pointerMoves &&
    a.pointerCells === b.pointerCells &&
    a.touchEvents === b.touchEvents &&
    a.keyEvents === b.keyEvents &&
    a.tabSwitches === b.tabSwitches
  );
}

function populationStdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export interface BaseScoreResult {
  presence: number;
  interaction: number;
  base: number;
  visibleRatio: number;
}

/** Step 1: base score (spec section 7). */
export function computeBaseScore(stats: BucketedStats, history: HistoryTick[]): BaseScoreResult {
  const visibleRatio = stats.visibleMs / stats.windowMs;
  const focusRatio = stats.focusedMs / stats.windowMs;
  const viewRatio = Math.min(1, stats.inViewportMs / stats.windowMs) * (stats.cvrPct / 100);
  const presence = 0.5 * visibleRatio + 0.2 * focusRatio + 0.3 * viewRatio;

  // Interaction is judged over the last 6 ticks (this one plus the previous 5), not per tick.
  const last6Stats = [...history.slice(-5).map((h) => h.stats), stats];
  const interactiveCount = last6Stats.filter(isInteractive).length;
  const interaction = Math.min(1, interactiveCount / 2);

  const base = 0.7 * presence + 0.3 * interaction;
  return { presence, interaction, base, visibleRatio };
}

export interface PenaltyResult {
  total: number;
  reasons: string[];
}

/** Step 2: penalties (spec section 7). */
export function computePenalties(
  stats: BucketedStats,
  serverGapMs: number,
  history: HistoryTick[],
): PenaltyResult {
  const reasons: string[] = [];
  let total = 0;

  if (serverGapMs < 3500 || serverGapMs > 8000) {
    total += PENALTY.GAP_OUT_OF_RANGE;
    reasons.push(REASON.GAP_OUT_OF_RANGE);
  }

  const last12Gaps = [...history.map((h) => h.gapMs), serverGapMs].slice(-12);
  if (last12Gaps.length >= 8 && populationStdDev(last12Gaps) < 8) {
    total += PENALTY.GAP_TOO_REGULAR;
    reasons.push(REASON.GAP_TOO_REGULAR);
  }

  const last6Stats = [...history.slice(-5).map((h) => h.stats), stats];
  if (last6Stats.length >= 6) {
    let allMatch = true;
    for (let i = 1; i < last6Stats.length; i++) {
      const prev = last6Stats[i - 1];
      const cur = last6Stats[i];
      if (!prev || !cur || !statsEqualExceptWindowMs(prev, cur)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      total += PENALTY.STATS_REPEATING;
      reasons.push(REASON.STATS_REPEATING);
    }
  }

  const last12Stats = [...history.slice(-11).map((h) => h.stats), stats];
  if (!last12Stats.some(isInteractive)) {
    total += PENALTY.NO_INTERACTION_LONG;
    reasons.push(REASON.NO_INTERACTION_LONG);
  }

  if (stats.scrollSpeedMax > 20000) {
    total += PENALTY.IMPOSSIBLE_SCROLL;
    reasons.push(REASON.IMPOSSIBLE_SCROLL);
  }

  return { total, reasons };
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

/** Step 2 (continued) + step 3 boundary: clamp, hidden-tab cap, IP penalties. */
export function computeScore(
  base: number,
  penalties: PenaltyResult,
  visibleRatio: number,
  ipClass: "residential" | "datacenter" | "tor" | "unknown",
): ScoreResult {
  let total = penalties.total;
  const reasons = [...penalties.reasons];

  if (ipClass === "datacenter") {
    total += PENALTY.IP_DATACENTER;
    reasons.push(REASON.IP_DATACENTER);
  } else if (ipClass === "tor") {
    total += PENALTY.IP_TOR;
    reasons.push(REASON.IP_TOR);
  }

  let score = clamp(base - total, 0, 1);
  if (visibleRatio < 0.5) {
    score = Math.min(score, 0.45);
    reasons.push(REASON.HIDDEN);
  }
  return { score, reasons };
}

export interface VerdictResult {
  verdict: Verdict;
  verdictWeight: number;
}

/** Step 3: verdict and weight (spec section 7). */
export function computeVerdict(score: number): VerdictResult {
  if (score >= 0.8) return { verdict: "pay", verdictWeight: 1.0 };
  if (score >= 0.5) return { verdict: "pay_reduced", verdictWeight: 0.5 };
  if (score >= 0.3) return { verdict: "hold", verdictWeight: 0 };
  return { verdict: "reject", verdictWeight: 0 };
}
