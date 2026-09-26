import { describe, expect, it } from "vitest";
import { combineRuleResults, evaluateRules, type LinkRiskSignals } from "../src/rules.js";

function signals(overrides: Partial<LinkRiskSignals> = {}): LinkRiskSignals {
  return {
    linkId: "0xlink",
    totalTicks: 0,
    rejectRate: 0,
    botSignatureRate: 0,
    sessionCount: 0,
    dominantSourceRatio: 0,
    ...overrides,
  };
}

describe("evaluateRules", () => {
  it("fires no rules for a clean, well-sampled link", () => {
    expect(evaluateRules(signals({ totalTicks: 100, sessionCount: 20, rejectRate: 0.1, botSignatureRate: 0.05, dominantSourceRatio: 0.2 }))).toEqual([]);
  });

  it("does not fire on a small sample even with a bad-looking rate", () => {
    // Only 5 ticks, all rejects — not enough samples to trust the signal.
    expect(evaluateRules(signals({ totalTicks: 5, rejectRate: 1.0 }))).toEqual([]);
  });

  it("fires BOT_SIGNATURE (level 3, hold) once the bot-signature rate crosses its threshold", () => {
    const results = evaluateRules(signals({ totalTicks: 50, botSignatureRate: 0.6 }));
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ rule: "BOT_SIGNATURE", level: 3, suggestedHold: true });
  });

  it("fires REJECT_RATE_HIGH (level 2, reduced weight) once the reject rate crosses its threshold", () => {
    const results = evaluateRules(signals({ totalTicks: 50, rejectRate: 0.7 }));
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ rule: "REJECT_RATE_HIGH", level: 2, suggestedWeightMultiplier: 0.5 });
  });

  it("fires SOURCE_CONCENTRATION once one ip_hash dominates enough sessions", () => {
    const results = evaluateRules(signals({ sessionCount: 10, dominantSourceRatio: 0.9 }));
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ rule: "SOURCE_CONCENTRATION", level: 2 });
  });

  it("does not fire SOURCE_CONCENTRATION on too few sessions even at 100% concentration", () => {
    expect(evaluateRules(signals({ sessionCount: 2, dominantSourceRatio: 1.0 }))).toEqual([]);
  });

  it("can fire multiple rules at once", () => {
    const results = evaluateRules(signals({ totalTicks: 50, rejectRate: 0.7, botSignatureRate: 0.6, sessionCount: 10, dominantSourceRatio: 0.9 }));
    expect(results.map((r) => r.rule).sort()).toEqual(["BOT_SIGNATURE", "REJECT_RATE_HIGH", "SOURCE_CONCENTRATION"]);
  });
});

describe("combineRuleResults", () => {
  it("holds if any firing rule suggests it, regardless of the others", () => {
    const decision = combineRuleResults(evaluateRules(signals({ totalTicks: 50, botSignatureRate: 0.6, rejectRate: 0.1 })));
    expect(decision.hold).toBe(true);
  });

  it("takes the minimum (most severe) weight multiplier across firing rules", () => {
    const decision = combineRuleResults([
      { rule: "A", level: 2, evidence: {}, suggestedWeightMultiplier: 0.5 },
      { rule: "B", level: 2, evidence: {}, suggestedWeightMultiplier: 0.3 },
    ]);
    expect(decision.weightMultiplier).toBe(0.3);
  });

  it("defaults to weightMultiplier 1.0 and hold false when nothing fired", () => {
    expect(combineRuleResults([])).toEqual({ hold: false, weightMultiplier: 1.0 });
  });
});
