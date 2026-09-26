import type { BucketedStats, HistoryTick, IpClass, TickScoringInput } from "../../src/types.js";

const NOW_MS = 1_800_000_000_000;
const LONG_AGO_MS = NOW_MS - 48 * 3600 * 1000; // well past the 24h warm-up window

function s(overrides: Partial<BucketedStats>): BucketedStats {
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

/** 5 varied, interactive, non-identical ticks: base=1.0, zero step-2 penalties. */
function variedInteractiveHistory(): HistoryTick[] {
  const gaps = [5000, 4800, 5200, 4900, 5100];
  return gaps.map((gapMs, i) => ({
    stats: s({ scrollEvents: 1 + (i % 3), scrollDepthPct: 10 + i * 5 }),
    gapMs,
    score: 0.9,
  }));
}

function baseInput(overrides: Partial<TickScoringInput>, ipClass: IpClass = "residential"): TickScoringInput {
  return {
    stats: s({ scrollEvents: 3, scrollDepthPct: 40, scrollSpeedMax: 800, pointerMoves: 15, pointerCells: 10 }),
    serverGapMs: 5000,
    history: variedInteractiveHistory(),
    ipClass,
    sessionSecondsPaid: 0,
    linkRisk: { weightMultiplier: 1.0, hold: false },
    ratePerSecond: 200,
    linkFirstTickMs: LONG_AGO_MS,
    nowMs: NOW_MS,
    ...overrides,
  };
}

/** A: clean human-like tick. base=1.0, no penalties -> score 1.0, verdict pay. */
export const HUMAN_LIKE = baseInput({});

/** B: scripted bot — metronomic gaps, frozen stats, no interaction, datacenter IP. */
export const SCRIPTED_BOT: TickScoringInput = {
  stats: s({ scrollSpeedMax: 0 }), // identical to history below apart from windowMs; non-interactive
  serverGapMs: 5000,
  history: Array.from({ length: 11 }, () => ({
    stats: s({ scrollSpeedMax: 0 }),
    gapMs: 5000,
    score: 0,
  })),
  ipClass: "datacenter",
  sessionSecondsPaid: 0,
  linkRisk: { weightMultiplier: 1.0, hold: false },
  ratePerSecond: 200,
  linkFirstTickMs: NOW_MS, // brand new link -> warm-up applies, though weight is already 0
  nowMs: NOW_MS,
};

/** C: hidden tab — tab backgrounded, no interaction. */
export const HIDDEN_TAB: TickScoringInput = baseInput({
  stats: s({ visibleMs: 1000, focusedMs: 0, inViewportMs: 0, cvrPct: 0 }),
  history: [],
  linkFirstTickMs: LONG_AGO_MS,
});

/** D: repeated stats — identical payload every tick, but otherwise plausible timing (only STATS_REPEATING fires). */
export const REPEATED_STATS: TickScoringInput = (() => {
  const repeated = s({
    scrollEvents: 5,
    scrollDepthPct: 50,
    scrollSpeedMax: 500,
    pointerMoves: 10,
    pointerCells: 5,
  });
  const gaps = [4000, 6000, 4500, 5500, 5000];
  return baseInput({
    stats: repeated,
    history: gaps.map((gapMs) => ({ stats: repeated, gapMs, score: 0.6 })),
  });
})();

/** E: datacenter IP, otherwise clean human-like behavior (isolates IP_DATACENTER). */
export const DATACENTER: TickScoringInput = baseInput({}, "datacenter");

/** F: Tor IP, otherwise clean human-like behavior (isolates IP_TOR). */
export const TOR: TickScoringInput = baseInput({}, "tor");
