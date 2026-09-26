import { describe, expect, it } from "vitest";
import type { OracleVerdictRequest } from "@kawaipay/shared";
import { scoreVerdictRequest } from "../src/verdict.js";

const HUMAN_LIKE_STATS = {
  windowMs: 5000,
  visibleMs: 5000,
  focusedMs: 5000,
  inViewportMs: 5000,
  contentViewportRatio: 1,
  scrollEvents: 3,
  scrollDepthPct: 40,
  scrollSpeedMax: 500,
  pointerMoves: 10,
  pointerCells: 10,
  touchEvents: 0,
  keyEvents: 0,
  tabSwitches: 0,
};

const SCRIPTED_STATS = {
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
};

describe("scoreVerdictRequest", () => {
  it("scores a run of human-like ticks well and a run of scripted-looking ticks poorly, never returning an amount field", () => {
    const humanRequest: OracleVerdictRequest = {
      // Stats vary slightly tick to tick (real human behavior) to avoid STATS_REPEATING,
      // which fires on 6 truly identical ticks in a row regardless of how human-like they are.
      ticks: Array.from({ length: 6 }, (_, i) => ({ gapMs: 5000, stats: { ...HUMAN_LIKE_STATS, scrollDepthPct: 40 + i } })),
      ipClass: "residential",
    };
    const scriptedRequest: OracleVerdictRequest = {
      ticks: Array.from({ length: 6 }, () => ({ gapMs: 5000, stats: SCRIPTED_STATS })),
      ipClass: "residential",
    };
    const humanResult = scoreVerdictRequest(humanRequest, 1_800_000_000_000);
    const scriptedResult = scoreVerdictRequest(scriptedRequest, 1_800_000_000_000);

    expect(humanResult.results).toHaveLength(6);
    expect(humanResult.results.at(-1)!.score).toBeGreaterThan(scriptedResult.results.at(-1)!.score);
    expect(humanResult.results.at(-1)!.verdict).toBe("pay");
    expect(scriptedResult.results.at(-1)!.verdict).not.toBe("pay");
    for (const r of [...humanResult.results, ...scriptedResult.results]) {
      expect(r).not.toHaveProperty("amount");
    }
    expect(humanResult.scorerVersion).toBe("1.0.0");
  });

  it("is a pure function: the same request always produces the same result", () => {
    const request: OracleVerdictRequest = { ticks: [{ gapMs: 5000, stats: HUMAN_LIKE_STATS }], ipClass: "residential" };
    const a = scoreVerdictRequest(request, 1_800_000_000_000);
    const b = scoreVerdictRequest(request, 1_800_000_000_000);
    expect(a).toEqual(b);
  });

  it("builds interaction history across the submitted ticks, not just per-tick", () => {
    // A single isolated no-interaction tick still gets some interaction credit from the
    // scorer's trailing-6-tick window; a whole run of them should score interaction as 0.
    const request: OracleVerdictRequest = {
      ticks: Array.from({ length: 6 }, () => ({ gapMs: 5000, stats: SCRIPTED_STATS })),
      ipClass: "residential",
    };
    const result = scoreVerdictRequest(request, 1_800_000_000_000);
    expect(result.results[5]!.reasons).toContain("NO_INTERACTION_LONG");
  });

  it("penalizes a datacenter IP class relative to residential, all else equal", () => {
    const base: OracleVerdictRequest = { ticks: [{ gapMs: 5000, stats: HUMAN_LIKE_STATS }], ipClass: "residential" };
    const datacenter: OracleVerdictRequest = { ...base, ipClass: "datacenter" };
    const residentialResult = scoreVerdictRequest(base, 1_800_000_000_000);
    const datacenterResult = scoreVerdictRequest(datacenter, 1_800_000_000_000);
    expect(datacenterResult.results[0]!.score).toBeLessThan(residentialResult.results[0]!.score);
    expect(datacenterResult.results[0]!.reasons).toContain("IP_DATACENTER");
  });
});
