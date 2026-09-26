import { describe, expect, it } from "vitest";
import { scoreTick } from "../src/index.js";
import { DEFAULT_CAP_LIMITS } from "../src/types.js";
import {
  DATACENTER,
  HIDDEN_TAB,
  HUMAN_LIKE,
  REPEATED_STATS,
  SCRIPTED_BOT,
  TOR,
} from "./fixtures/scenarios.js";

const ZERO_USAGE = { linkHourlyEarned: 0, sourceHourlyEarned: 0 };

// Every "expected" value below is hand-derived from the section 7 formulas (see
// test/fixtures/scenarios.ts for the reasoning), not produced by running the scorer,
// so these are real regression pins, not tautologies.

describe("golden fixtures (spec section 7)", () => {
  it("human-like: full presence + interaction, no penalties -> pay at score 1.0", () => {
    const r = scoreTick(HUMAN_LIKE, ZERO_USAGE);
    expect(r.score).toBeCloseTo(1.0, 10);
    expect(r.verdict).toBe("pay");
    expect(r.weightBp).toBe(10000);
    expect(r.amount).toBe(1000); // rate 200 * 5s * 100%
    expect(r.reasons).toEqual([]);
  });

  it("scripted bot: regular gaps + frozen stats + no interaction + datacenter -> rejected, earns 0", () => {
    const r = scoreTick(SCRIPTED_BOT, ZERO_USAGE);
    expect(r.score).toBe(0);
    expect(r.verdict).toBe("reject");
    expect(r.amount).toBe(0);
    expect(r.reasons).toEqual([
      "GAP_TOO_REGULAR",
      "IP_DATACENTER",
      "NO_INTERACTION_LONG",
      "STATS_REPEATING",
    ]);
    // Acceptance criterion from section 14: a bot fixture must earn far less than a human one.
    const human = scoreTick(HUMAN_LIKE, ZERO_USAGE);
    expect(r.amount).toBeLessThan(human.amount * 0.2);
  });

  it("hidden tab: capped at 0.45 but flagged, and reject on its own eventually pays nothing", () => {
    const r = scoreTick(HIDDEN_TAB, ZERO_USAGE);
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual(["HIDDEN", "NO_INTERACTION_LONG"]);
    expect(r.verdict).toBe("reject");
    expect(r.amount).toBe(0);
  });

  it("repeated stats: only STATS_REPEATING fires -> pay_reduced at score 0.6", () => {
    const r = scoreTick(REPEATED_STATS, ZERO_USAGE);
    expect(r.score).toBeCloseTo(0.6, 10);
    expect(r.verdict).toBe("pay_reduced");
    expect(r.weightBp).toBe(5000);
    expect(r.amount).toBe(500);
    expect(r.reasons).toEqual(["STATS_REPEATING"]);
  });

  it("datacenter IP alone: score drops from 1.0 to 0.7 -> pay_reduced", () => {
    const r = scoreTick(DATACENTER, ZERO_USAGE);
    expect(r.score).toBeCloseTo(0.7, 10);
    expect(r.verdict).toBe("pay_reduced");
    expect(r.amount).toBe(500);
    expect(r.reasons).toEqual(["IP_DATACENTER"]);
  });

  it("Tor IP alone: score drops from 1.0 to exactly 0.8, still pay at the boundary", () => {
    const r = scoreTick(TOR, ZERO_USAGE);
    expect(r.score).toBeCloseTo(0.8, 10);
    expect(r.verdict).toBe("pay");
    expect(r.amount).toBe(1000);
    expect(r.reasons).toEqual(["IP_TOR"]);
  });

  it("caps still apply on top of a golden fixture's amount", () => {
    const r = scoreTick(HUMAN_LIKE, { linkHourlyEarned: DEFAULT_CAP_LIMITS.linkHourlyCap - 100, sourceHourlyEarned: 0 });
    expect(r.amount).toBe(100);
    expect(r.reasons).toEqual(["LINK_HOURLY_CAP"]);
  });
});
