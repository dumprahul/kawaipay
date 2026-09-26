/** A Sui object ID: lowercase 0x-prefixed 64-hex string (spec section 1, "Object IDs"). */
export type ObjectId = string;

/** USDC (or any coin) amount in integer base units. Never a float. */
export type BaseUnits = number;

export type IpClass = "residential" | "datacenter" | "tor" | "unknown";
export type Verdict = "pay" | "pay_reduced" | "hold" | "reject";

/** The raw stats object the SDK sends per heartbeat (spec section 6), before bucketing. */
export interface RawStats {
  windowMs: number;
  visibleMs: number;
  focusedMs: number;
  inViewportMs: number;
  /** 0-1 fraction; bucketed form converts this to an integer percent (cvrPct). */
  contentViewportRatio: number;
  scrollEvents: number;
  scrollDepthPct: number;
  scrollSpeedMax: number;
  pointerMoves: number;
  pointerCells: number;
  touchEvents: number;
  keyEvents: number;
  tabSwitches: number;
}

/** Section 11 bucketed stats — the only form oracle-core, the ticks table, and the log ever see. */
export interface BucketedStats {
  windowMs: number;
  visibleMs: number;
  focusedMs: number;
  inViewportMs: number;
  /** Integer percent, 0-100. Formulas use contentViewportRatio = cvrPct / 100. */
  cvrPct: number;
  scrollEvents: number;
  scrollDepthPct: number;
  scrollSpeedMax: number;
  pointerMoves: number;
  pointerCells: number;
  touchEvents: number;
  keyEvents: number;
  tabSwitches: number;
}

/** One previously-scored tick, oldest-first ordering is the caller's responsibility. */
export interface HistoryTick {
  stats: BucketedStats;
  /** server_gap_ms recorded for that tick. */
  gapMs: number;
  score: number;
}

export interface LinkRiskState {
  weightMultiplier: number;
  hold: boolean;
}

export interface CapUsage {
  linkHourlyEarned: BaseUnits;
  sourceHourlyEarned: BaseUnits;
}

export interface CapLimits {
  linkHourlyCap: BaseUnits;
  sourceHourlyCap: BaseUnits;
}

export interface TickResult {
  score: number;
  verdict: Verdict;
  /** Integer basis points, 0-10000. */
  weightBp: number;
  amount: BaseUnits;
  reasons: string[];
  scorerVersion: string;
}

/** The on-chain Attestation struct (payout.move), BCS-encoded by encodeAttestation. */
export interface Attestation {
  campaignId: ObjectId;
  linkId: ObjectId;
  seq: number;
  secondsVerified: number;
  amount: BaseUnits;
  /** 32 raw bytes. */
  logRoot: Uint8Array;
  expiresAtMs: number;
}

/** The Oracle-signed verdict payload returned by the x402 API (spec section 12). */
export interface VerdictResponse {
  verdict: Verdict;
  score: number;
  weightBp: number;
  reasons: string[];
  scorerVersion: string;
  requestHash: string;
  issuedAtMs: number;
  signature: string;
}
