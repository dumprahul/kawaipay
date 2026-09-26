import { describe, expect, it } from "vitest";
import { bucketStats } from "../src/bucketing.js";
import type { RawStats } from "../src/types.js";

function raw(overrides: Partial<RawStats> = {}): RawStats {
  return {
    windowMs: 5000,
    visibleMs: 5000,
    focusedMs: 5000,
    inViewportMs: 5000,
    contentViewportRatio: 1,
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

describe("bucketStats (spec section 11)", () => {
  it("rounds windowMs to the nearest 100", () => {
    expect(bucketStats(raw({ windowMs: 5049 })).windowMs).toBe(5000);
    expect(bucketStats(raw({ windowMs: 5050 })).windowMs).toBe(5100);
  });

  it("rounds visibleMs/focusedMs/inViewportMs to the nearest 250", () => {
    const r = bucketStats(raw({ visibleMs: 1100, focusedMs: 1249, inViewportMs: 1251 }));
    expect(r.visibleMs).toBe(1000);
    expect(r.focusedMs).toBe(1250);
    expect(r.inViewportMs).toBe(1250);
  });

  it("converts contentViewportRatio to an integer percent", () => {
    expect(bucketStats(raw({ contentViewportRatio: 0.834 })).cvrPct).toBe(83);
    expect(bucketStats(raw({ contentViewportRatio: 0 })).cvrPct).toBe(0);
    expect(bucketStats(raw({ contentViewportRatio: 1 })).cvrPct).toBe(100);
  });

  it("keeps 0 at 0, and rounds 1+ up to the next multiple of 5 for event counts", () => {
    for (const field of ["scrollEvents", "pointerMoves", "touchEvents", "keyEvents"] as const) {
      expect(bucketStats(raw({ [field]: 0 }))[field]).toBe(0);
      expect(bucketStats(raw({ [field]: 1 }))[field]).toBe(5);
      expect(bucketStats(raw({ [field]: 5 }))[field]).toBe(5);
      expect(bucketStats(raw({ [field]: 6 }))[field]).toBe(10);
    }
  });

  it("rounds scrollDepthPct up to a multiple of 10", () => {
    expect(bucketStats(raw({ scrollDepthPct: 0 })).scrollDepthPct).toBe(0);
    expect(bucketStats(raw({ scrollDepthPct: 1 })).scrollDepthPct).toBe(10);
    expect(bucketStats(raw({ scrollDepthPct: 40 })).scrollDepthPct).toBe(40);
    expect(bucketStats(raw({ scrollDepthPct: 41 })).scrollDepthPct).toBe(50);
  });

  it("leaves scrollSpeedMax unchanged", () => {
    expect(bucketStats(raw({ scrollSpeedMax: 12345 })).scrollSpeedMax).toBe(12345);
  });

  it("rounds pointerCells up to an even number", () => {
    expect(bucketStats(raw({ pointerCells: 4 })).pointerCells).toBe(4);
    expect(bucketStats(raw({ pointerCells: 5 })).pointerCells).toBe(6);
  });

  it("leaves tabSwitches unchanged", () => {
    expect(bucketStats(raw({ tabSwitches: 3 })).tabSwitches).toBe(3);
  });
});
