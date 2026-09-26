// Cross-cutting types and constants live in @kawaipay/shared and are re-exported here
// so the rest of this package doesn't need to know where they're canonically defined.
export {
  TICK_SECONDS,
  SCORER_VERSION,
  WARMUP_FACTOR,
  WARMUP_HOURS,
  DEFAULT_CAP_LIMITS,
} from "@kawaipay/shared";
export type {
  BucketedStats,
  IpClass,
  Verdict,
  HistoryTick,
  LinkRiskState,
  CapUsage,
  CapLimits,
  TickResult,
} from "@kawaipay/shared";

import type { BucketedStats, HistoryTick, IpClass, LinkRiskState } from "@kawaipay/shared";

/** Everything needed to score one tick (spec section 7, "Scoring a tick: inputs"). */
export interface TickScoringInput {
  stats: BucketedStats;
  /** server_gap_ms for this tick: ms since the previous heartbeat, or since session start for tick 1. */
  serverGapMs: number;
  /** The session's previous ticks, oldest first. Up to the last 12 are used. */
  history: HistoryTick[];
  ipClass: IpClass;
  /** Seconds already paid in this session before this tick (drives sessionDecay). */
  sessionSecondsPaid: number;
  linkRisk: LinkRiskState;
  /** Campaign's rate_per_second, integer base units. */
  ratePerSecond: number;
  /** ms since epoch of the link's first-ever tick (drives warm-up). */
  linkFirstTickMs: number;
  /** ms since epoch "now" (server time of this tick). */
  nowMs: number;
}
