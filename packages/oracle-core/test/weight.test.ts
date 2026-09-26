import { describe, expect, it } from "vitest";
import { applyCaps, computeAmount, computeFinalWeight, computeSessionDecay, computeWarmup } from "../src/weight.js";
import { DEFAULT_CAP_LIMITS } from "../src/types.js";

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe("computeWarmup", () => {
  it("is 0.5 immediately after the link's first tick", () => {
    expect(computeWarmup(1_000_000, 1_000_000)).toBe(0.5);
  });
  it("is 0.5 just before the 24h boundary", () => {
    expect(computeWarmup(1_000_000 + DAY_MS - 1, 1_000_000)).toBe(0.5);
  });
  it("is 1.0 exactly at the 24h boundary", () => {
    expect(computeWarmup(1_000_000 + DAY_MS, 1_000_000)).toBe(1.0);
  });
  it("is 1.0 well past the boundary", () => {
    expect(computeWarmup(1_000_000 + DAY_MS * 10, 1_000_000)).toBe(1.0);
  });
});

describe("computeSessionDecay", () => {
  it("is 1.0 at and below 600s", () => {
    expect(computeSessionDecay(0)).toBe(1.0);
    expect(computeSessionDecay(600)).toBe(1.0);
  });
  it("is 0.2 at and above 2400s", () => {
    expect(computeSessionDecay(2400)).toBe(0.2);
    expect(computeSessionDecay(5000)).toBe(0.2);
  });
  it("interpolates linearly at the midpoint (1500s)", () => {
    // t = (1500-600)/(2400-600) = 0.5 -> 1.0 - 0.8*0.5 = 0.6
    expect(computeSessionDecay(1500)).toBeCloseTo(0.6, 10);
  });
});

describe("computeFinalWeight", () => {
  it("multiplies all four factors when nothing is on hold", () => {
    const r = computeFinalWeight(0.5, { weightMultiplier: 0.5, hold: false }, 1.0, 0.5);
    // 0.5 * 0.5 * 1.0 * 0.5 = 0.125
    expect(r.weight).toBeCloseTo(0.125, 10);
    expect(r.weightBp).toBe(1250);
    expect(r.reasons).toEqual([]);
  });

  it("forces weight to zero and adds LINK_HOLD when the link is held, regardless of other factors", () => {
    const r = computeFinalWeight(1.0, { weightMultiplier: 1.0, hold: true }, 1.0, 1.0);
    expect(r.weight).toBe(0);
    expect(r.weightBp).toBe(0);
    expect(r.reasons).toEqual(["LINK_HOLD"]);
  });

  it("full weight when verdict is pay and nothing discounts it", () => {
    const r = computeFinalWeight(1.0, { weightMultiplier: 1.0, hold: false }, 1.0, 1.0);
    expect(r.weightBp).toBe(10000);
  });
});

describe("computeAmount", () => {
  it("pays the full rate*5s at weight 10000bp", () => {
    expect(computeAmount(200, 10000)).toBe(1000);
  });
  it("halves at weight 5000bp", () => {
    expect(computeAmount(200, 5000)).toBe(500);
  });
  it("truncates rather than rounds (integer math only)", () => {
    // 3 * 5 * 3333 / 10000 = 4.9995 -> floor -> 4
    expect(computeAmount(3, 3333)).toBe(4);
  });
  it("is zero at weight 0", () => {
    expect(computeAmount(200, 0)).toBe(0);
  });
});

describe("applyCaps", () => {
  it("trims to the link's remaining hourly budget and flags LINK_HOURLY_CAP", () => {
    const r = applyCaps(
      1000,
      { linkHourlyEarned: 4_999_500, sourceHourlyEarned: 0 },
      DEFAULT_CAP_LIMITS,
      "residential",
    );
    expect(r.amount).toBe(500);
    expect(r.reasons).toEqual(["LINK_HOURLY_CAP"]);
  });

  it("trims to the source's remaining hourly budget and flags SOURCE_HOURLY_CAP", () => {
    const r = applyCaps(
      500,
      { linkHourlyEarned: 0, sourceHourlyEarned: 999_800 },
      DEFAULT_CAP_LIMITS,
      "residential",
    );
    expect(r.amount).toBe(200);
    expect(r.reasons).toEqual(["SOURCE_HOURLY_CAP"]);
  });

  it("quarters the source cap for datacenter and tor traffic", () => {
    const r = applyCaps(
      300_000,
      { linkHourlyEarned: 0, sourceHourlyEarned: 0 },
      DEFAULT_CAP_LIMITS,
      "tor",
    );
    // sourceHourlyCap 1,000,000 * 0.25 = 250,000
    expect(r.amount).toBe(250_000);
    expect(r.reasons).toEqual(["SOURCE_HOURLY_CAP"]);
  });

  it("never returns a negative amount even if usage already exceeds the cap", () => {
    const r = applyCaps(
      100,
      { linkHourlyEarned: 10_000_000, sourceHourlyEarned: 0 },
      DEFAULT_CAP_LIMITS,
      "residential",
    );
    expect(r.amount).toBe(0);
  });

  it("does not trim or add a reason when comfortably under both caps", () => {
    const r = applyCaps(100, { linkHourlyEarned: 0, sourceHourlyEarned: 0 }, DEFAULT_CAP_LIMITS, "residential");
    expect(r.amount).toBe(100);
    expect(r.reasons).toEqual([]);
  });
});
