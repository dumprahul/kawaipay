import { describe, expect, it } from "vitest";
import { scoreTick } from "../src/index.js";
import { computeScore } from "../src/scorer.js";
import { DEFAULT_CAP_LIMITS, TICK_SECONDS, type BucketedStats, type IpClass, type TickScoringInput } from "../src/types.js";

// Deterministic PRNG (mulberry32) so property-test failures are always reproducible.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const IP_CLASSES: IpClass[] = ["residential", "datacenter", "tor", "unknown"];

function randomStats(rand: () => number): BucketedStats {
  const windowMs = 3000 + Math.floor(rand() * 5000);
  return {
    windowMs,
    visibleMs: Math.floor(rand() * windowMs),
    focusedMs: Math.floor(rand() * windowMs),
    inViewportMs: Math.floor(rand() * windowMs),
    cvrPct: Math.floor(rand() * 101),
    scrollEvents: Math.floor(rand() * 20),
    scrollDepthPct: Math.floor(rand() * 101),
    scrollSpeedMax: Math.floor(rand() * 30000),
    pointerMoves: Math.floor(rand() * 20),
    pointerCells: Math.floor(rand() * 50),
    touchEvents: Math.floor(rand() * 10),
    keyEvents: Math.floor(rand() * 10),
    tabSwitches: Math.floor(rand() * 5),
  };
}

function randomInput(rand: () => number): TickScoringInput {
  const nowMs = 2_000_000_000_000;
  return {
    stats: randomStats(rand),
    serverGapMs: 1000 + Math.floor(rand() * 10000),
    history: Array.from({ length: Math.floor(rand() * 13) }, () => ({
      stats: randomStats(rand),
      gapMs: 1000 + Math.floor(rand() * 10000),
      score: rand(),
    })),
    ipClass: IP_CLASSES[Math.floor(rand() * IP_CLASSES.length)] as IpClass,
    sessionSecondsPaid: Math.floor(rand() * 4000),
    linkRisk: { weightMultiplier: rand(), hold: rand() < 0.1 },
    ratePerSecond: 1 + Math.floor(rand() * 5000),
    linkFirstTickMs: nowMs - Math.floor(rand() * 3 * 24 * 3600 * 1000),
    nowMs,
  };
}

const ZERO_USAGE = { linkHourlyEarned: 0, sourceHourlyEarned: 0 };
const N = 500;

describe("property: invariants over random inputs", () => {
  const rand = mulberry32(42);

  it("amount never exceeds rate_per_second * TICK_SECONDS (uncapped ceiling)", () => {
    for (let i = 0; i < N; i++) {
      const input = randomInput(rand);
      const r = scoreTick(input, ZERO_USAGE, {
        linkHourlyCap: Number.MAX_SAFE_INTEGER,
        sourceHourlyCap: Number.MAX_SAFE_INTEGER,
      });
      expect(r.amount).toBeLessThanOrEqual(input.ratePerSecond * TICK_SECONDS);
    }
  });

  it("amount is never negative, even under caps already exceeded", () => {
    for (let i = 0; i < N; i++) {
      const input = randomInput(rand);
      const r = scoreTick(input, { linkHourlyEarned: 1e9, sourceHourlyEarned: 1e9 }, DEFAULT_CAP_LIMITS);
      expect(r.amount).toBeGreaterThanOrEqual(0);
    }
  });

  it("score is always within [0, 1]", () => {
    for (let i = 0; i < N; i++) {
      const input = randomInput(rand);
      const r = scoreTick(input, ZERO_USAGE);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it("weightBp is always within [0, 10000]", () => {
    for (let i = 0; i < N; i++) {
      const input = randomInput(rand);
      const r = scoreTick(input, ZERO_USAGE);
      expect(r.weightBp).toBeGreaterThanOrEqual(0);
      expect(r.weightBp).toBeLessThanOrEqual(10000);
    }
  });

  it("adding any single step-2/3 penalty never raises the score", () => {
    for (let i = 0; i < N; i++) {
      const base = rand();
      const visibleRatio = rand();
      const ipClass = IP_CLASSES[Math.floor(rand() * IP_CLASSES.length)] as IpClass;
      const withoutExtra = computeScore(base, { total: 0, reasons: [] }, visibleRatio, ipClass);
      const extraPenalty = rand() * 0.5;
      const withExtra = computeScore(base, { total: extraPenalty, reasons: ["X"] }, visibleRatio, ipClass);
      expect(withExtra.score).toBeLessThanOrEqual(withoutExtra.score);
    }
  });

  it("hold always forces amount to 0 regardless of everything else", () => {
    for (let i = 0; i < N; i++) {
      const input = randomInput(rand);
      input.linkRisk = { weightMultiplier: input.linkRisk.weightMultiplier, hold: true };
      const r = scoreTick(input, ZERO_USAGE, {
        linkHourlyCap: Number.MAX_SAFE_INTEGER,
        sourceHourlyCap: Number.MAX_SAFE_INTEGER,
      });
      expect(r.amount).toBe(0);
      expect(r.reasons).toContain("LINK_HOLD");
    }
  });

  it("result is deterministic: scoring the same input twice yields identical output", () => {
    for (let i = 0; i < 50; i++) {
      const input = randomInput(rand);
      const usage = { linkHourlyEarned: Math.floor(rand() * 1000), sourceHourlyEarned: Math.floor(rand() * 1000) };
      const r1 = scoreTick(input, usage);
      const r2 = scoreTick(input, usage);
      expect(r1).toEqual(r2);
    }
  });
});
