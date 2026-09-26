import type { BucketedStats, RawStats } from "./types.js";

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** 0 stays 0; any value from 1 up rounds up to the next multiple of `step` (spec section 11). */
function roundUpToMultiple(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function roundUpToEven(value: number): number {
  return value % 2 === 0 ? value : value + 1;
}

/**
 * Converts raw SDK stats to the bucketed form (spec section 11). This is the only
 * transformation the gateway applies before stats reach oracle-core, the ticks table,
 * and the audit log — bucketing exists for both privacy (coarser granularity) and
 * reproducibility (a logged tick contains everything needed to replay its score).
 */
export function bucketStats(raw: RawStats): BucketedStats {
  return {
    windowMs: roundToNearest(raw.windowMs, 100),
    visibleMs: roundToNearest(raw.visibleMs, 250),
    focusedMs: roundToNearest(raw.focusedMs, 250),
    inViewportMs: roundToNearest(raw.inViewportMs, 250),
    cvrPct: Math.min(100, Math.max(0, Math.round(raw.contentViewportRatio * 100))),
    scrollEvents: roundUpToMultiple(raw.scrollEvents, 5),
    scrollDepthPct: roundUpToMultiple(raw.scrollDepthPct, 10),
    scrollSpeedMax: raw.scrollSpeedMax,
    pointerMoves: roundUpToMultiple(raw.pointerMoves, 5),
    pointerCells: roundUpToEven(raw.pointerCells),
    touchEvents: roundUpToMultiple(raw.touchEvents, 5),
    keyEvents: roundUpToMultiple(raw.keyEvents, 5),
    tabSwitches: raw.tabSwitches,
  };
}
