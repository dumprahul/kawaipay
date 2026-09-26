import { describe, expect, it } from "vitest";
import { computeBaseScore, computePenalties, computeScore, computeVerdict } from "../src/scorer.js";
import type { BucketedStats, HistoryTick } from "../src/types.js";

function stats(overrides: Partial<BucketedStats> = {}): BucketedStats {
  return {
    windowMs: 5000,
    visibleMs: 5000,
    focusedMs: 5000,
    inViewportMs: 5000,
    cvrPct: 100,
    scrollEvents: 0,
    scrollDepthPct: 0,
    scrollSpeedMax: 0,
    pointerMoves: 0,
    pointerCells: 0,
    touchEvents: 0,
    keyEvents: 0,
    tabSwitches: 0,
    ...overrides,
  };
}

describe("computeBaseScore", () => {
  it("full presence + interactive tick with no history: interaction is capped by the /2 divisor", () => {
    const s = stats({ scrollEvents: 5 });
    const r = computeBaseScore(s, []);
    // presence = 0.5*1 + 0.2*1 + 0.3*(1*1) = 1.0
    expect(r.presence).toBeCloseTo(1.0, 10);
    // last6 = [current], interactiveCount=1, interaction = min(1, 1/2) = 0.5
    expect(r.interaction).toBeCloseTo(0.5, 10);
    // base = 0.7*1.0 + 0.3*0.5 = 0.85
    expect(r.base).toBeCloseTo(0.85, 10);
    expect(r.visibleRatio).toBeCloseTo(1.0, 10);
  });

  it("full presence, no interaction anywhere in the tick", () => {
    const s = stats();
    const r = computeBaseScore(s, []);
    expect(r.interaction).toBe(0);
    expect(r.base).toBeCloseTo(0.7, 10);
  });

  it("partial presence: half visible, no focus, not in viewport", () => {
    const s = stats({ visibleMs: 2500, focusedMs: 0, inViewportMs: 0, cvrPct: 0 });
    const r = computeBaseScore(s, []);
    // presence = 0.5*0.5 + 0.2*0 + 0.3*0 = 0.25
    expect(r.presence).toBeCloseTo(0.25, 10);
  });

  it("interaction saturates at 1.0 once 2+ of the last 6 ticks are interactive", () => {
    const history: HistoryTick[] = Array.from({ length: 5 }, () => ({
      stats: stats({ scrollEvents: 1 }),
      gapMs: 5000,
      score: 0.9,
    }));
    const r = computeBaseScore(stats({ scrollEvents: 1 }), history);
    // 6 interactive ticks among last 6 -> min(1, 6/2) = 1
    expect(r.interaction).toBe(1);
  });
});

describe("computePenalties", () => {
  it("GAP_OUT_OF_RANGE fires below 3500ms in isolation", () => {
    const r = computePenalties(stats({ scrollEvents: 1 }), 3000, []);
    expect(r.reasons).toEqual(["GAP_OUT_OF_RANGE"]);
    expect(r.total).toBeCloseTo(0.3, 10);
  });

  it("GAP_OUT_OF_RANGE fires above 8000ms", () => {
    const r = computePenalties(stats({ scrollEvents: 1 }), 8001, []);
    expect(r.reasons).toContain("GAP_OUT_OF_RANGE");
  });

  it("GAP_TOO_REGULAR needs 8+ gap samples and fires when they're identical", () => {
    const history: HistoryTick[] = Array.from({ length: 11 }, (_, i) => ({
      stats: stats({ scrollEvents: 1, scrollDepthPct: i }), // vary to dodge STATS_REPEATING
      gapMs: 5000,
      score: 0.1,
    }));
    const r = computePenalties(stats({ scrollEvents: 1, scrollDepthPct: 99 }), 5000, history);
    expect(r.reasons).toEqual(["GAP_TOO_REGULAR"]);
  });

  it("GAP_TOO_REGULAR does not fire with fewer than 8 gap samples, even if identical", () => {
    const history: HistoryTick[] = Array.from({ length: 5 }, (_, i) => ({
      stats: stats({ scrollEvents: 1, scrollDepthPct: i }),
      gapMs: 5000,
      score: 0.1,
    }));
    const r = computePenalties(stats({ scrollEvents: 1, scrollDepthPct: 99 }), 5000, history);
    expect(r.reasons).not.toContain("GAP_TOO_REGULAR");
  });

  it("STATS_REPEATING fires when the last 6 stats objects match apart from windowMs", () => {
    const identical = stats({ scrollEvents: 5 });
    const history: HistoryTick[] = Array.from({ length: 5 }, () => ({
      stats: { ...identical, windowMs: 4900 }, // windowMs differs, everything else the same
      gapMs: 5000,
      score: 0.5,
    }));
    const r = computePenalties(identical, 5000, history);
    expect(r.reasons).toContain("STATS_REPEATING");
  });

  it("STATS_REPEATING does not fire when any of the last 6 differ", () => {
    const history: HistoryTick[] = [0, 1, 2, 3, 4].map((i) => ({
      stats: stats({ scrollEvents: 1, scrollDepthPct: i * 5 }),
      gapMs: 5000,
      score: 0.5,
    }));
    const r = computePenalties(stats({ scrollEvents: 1, scrollDepthPct: 99 }), 5000, history);
    expect(r.reasons).not.toContain("STATS_REPEATING");
  });

  it("NO_INTERACTION_LONG fires when nothing in the available window is interactive", () => {
    const r = computePenalties(stats(), 5000, []);
    expect(r.reasons).toEqual(["NO_INTERACTION_LONG"]);
  });

  it("NO_INTERACTION_LONG does not fire if any tick in the last 12 was interactive", () => {
    const history: HistoryTick[] = [{ stats: stats({ keyEvents: 1 }), gapMs: 5000, score: 0.5 }];
    const r = computePenalties(stats(), 5000, history);
    expect(r.reasons).not.toContain("NO_INTERACTION_LONG");
  });

  it("IMPOSSIBLE_SCROLL fires above 20000 px/s", () => {
    const r = computePenalties(stats({ scrollEvents: 1, scrollSpeedMax: 20001 }), 5000, []);
    expect(r.reasons).toContain("IMPOSSIBLE_SCROLL");
  });

  it("IMPOSSIBLE_SCROLL does not fire at exactly 20000 px/s", () => {
    const r = computePenalties(stats({ scrollEvents: 1, scrollSpeedMax: 20000 }), 5000, []);
    expect(r.reasons).not.toContain("IMPOSSIBLE_SCROLL");
  });
});

describe("computeScore", () => {
  it("applies IP_DATACENTER penalty and clamps within [0,1]", () => {
    const r = computeScore(1.0, { total: 0, reasons: [] }, 1.0, "datacenter");
    expect(r.score).toBeCloseTo(0.7, 10);
    expect(r.reasons).toEqual(["IP_DATACENTER"]);
  });

  it("applies IP_TOR penalty", () => {
    const r = computeScore(1.0, { total: 0, reasons: [] }, 1.0, "tor");
    expect(r.score).toBeCloseTo(0.8, 10);
    expect(r.reasons).toEqual(["IP_TOR"]);
  });

  it("clamps below zero up to 0", () => {
    const r = computeScore(0.1, { total: 0.9, reasons: [] }, 1.0, "residential");
    expect(r.score).toBe(0);
  });

  it("clamps above one down to 1 (defensive; base/penalties should not normally allow this)", () => {
    const r = computeScore(1.5, { total: 0, reasons: [] }, 1.0, "residential");
    expect(r.score).toBe(1);
  });

  it("caps a hidden tab (visibleRatio < 0.5) at 0.45 and adds HIDDEN", () => {
    const r = computeScore(1.0, { total: 0, reasons: [] }, 0.3, "residential");
    expect(r.score).toBe(0.45);
    expect(r.reasons).toEqual(["HIDDEN"]);
  });

  it("does not apply the hidden cap at exactly visibleRatio 0.5", () => {
    const r = computeScore(1.0, { total: 0, reasons: [] }, 0.5, "residential");
    expect(r.score).toBe(1);
    expect(r.reasons).not.toContain("HIDDEN");
  });

  it("adding a penalty never raises the score", () => {
    const withoutPenalty = computeScore(0.9, { total: 0, reasons: [] }, 1.0, "residential");
    const withPenalty = computeScore(0.9, { total: 0.3, reasons: ["X"] }, 1.0, "residential");
    expect(withPenalty.score).toBeLessThanOrEqual(withoutPenalty.score);
  });
});

describe("computeVerdict", () => {
  it("pay at and above 0.80", () => {
    expect(computeVerdict(0.8)).toEqual({ verdict: "pay", verdictWeight: 1.0 });
    expect(computeVerdict(1.0)).toEqual({ verdict: "pay", verdictWeight: 1.0 });
  });
  it("pay_reduced from 0.50 up to just below 0.80", () => {
    expect(computeVerdict(0.5)).toEqual({ verdict: "pay_reduced", verdictWeight: 0.5 });
    expect(computeVerdict(0.79999)).toEqual({ verdict: "pay_reduced", verdictWeight: 0.5 });
  });
  it("hold from 0.30 up to just below 0.50", () => {
    expect(computeVerdict(0.3)).toEqual({ verdict: "hold", verdictWeight: 0 });
    expect(computeVerdict(0.49999)).toEqual({ verdict: "hold", verdictWeight: 0 });
  });
  it("reject below 0.30", () => {
    expect(computeVerdict(0.29999)).toEqual({ verdict: "reject", verdictWeight: 0 });
    expect(computeVerdict(0)).toEqual({ verdict: "reject", verdictWeight: 0 });
  });
});
