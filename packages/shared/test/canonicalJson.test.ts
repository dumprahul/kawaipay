import { describe, expect, it } from "vitest";
import { buildTickLogRecord, canonicalJson, canonicalTickRecordJson, computeSessionPseudonym, sortKeysAlphabetically } from "../src/canonicalJson.js";
import type { BucketedStats } from "../src/types.js";

describe("sortKeysAlphabetically / canonicalJson", () => {
  it("reorders keys alphabetically and serializes with no whitespace", () => {
    const obj = { c: 3, a: 1, b: 2 };
    expect(Object.keys(sortKeysAlphabetically(obj))).toEqual(["a", "b", "c"]);
    expect(canonicalJson(obj)).toBe('{"a":1,"b":2,"c":3}');
  });
});

describe("computeSessionPseudonym", () => {
  it("is deterministic and exactly 16 hex chars", () => {
    const sid = computeSessionPseudonym("session-1", "secret-a");
    expect(sid).toHaveLength(16);
    expect(sid).toMatch(/^[0-9a-f]{16}$/);
    expect(computeSessionPseudonym("session-1", "secret-a")).toBe(sid);
  });

  it("differs across sessions and across secrets", () => {
    const a = computeSessionPseudonym("session-1", "secret-a");
    const b = computeSessionPseudonym("session-2", "secret-a");
    const c = computeSessionPseudonym("session-1", "secret-b");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

const STATS: BucketedStats = {
  windowMs: 5000,
  visibleMs: 5000,
  focusedMs: 5000,
  inViewportMs: 5000,
  cvrPct: 100,
  scrollEvents: 5,
  scrollDepthPct: 40,
  scrollSpeedMax: 500,
  pointerMoves: 10,
  pointerCells: 6,
  touchEvents: 0,
  keyEvents: 0,
  tabSwitches: 0,
};

describe("buildTickLogRecord", () => {
  it("maps a raw ticks-row shape into the wire TickLogRecord fields", () => {
    const record = buildTickLogRecord(
      {
        sessionId: "session-1",
        receivedAt: new Date(1_800_000_000_000),
        seq: 7,
        serverGapMs: 5000,
        ipClass: "residential",
        features: STATS,
        score: 0.842,
        verdict: "pay",
        weight: 1,
        amount: 1000,
        reasons: ["HIDDEN"],
        scorerVersion: "1.0.0",
      },
      "secret-a",
    );
    expect(record).toEqual({
      v: 1,
      sid: computeSessionPseudonym("session-1", "secret-a"),
      t: 1_800_000_000_000,
      n: 7,
      gap: 5000,
      ipc: "residential",
      f: STATS,
      sc: 842,
      vd: "pay",
      w: 10000,
      a: 1000,
      r: ["HIDDEN"],
      sv: "1.0.0",
    });
  });

  it("defaults a null serverGapMs to 0", () => {
    const record = buildTickLogRecord(
      {
        sessionId: "session-1",
        receivedAt: new Date(1),
        seq: 1,
        serverGapMs: null,
        ipClass: "unknown",
        features: STATS,
        score: 0,
        verdict: "reject",
        weight: 0,
        amount: 0,
        reasons: [],
        scorerVersion: "1.0.0",
      },
      "secret-a",
    );
    expect(record.gap).toBe(0);
  });
});

describe("canonicalTickRecordJson", () => {
  it("uses the fixed top-level key order from spec section 11", () => {
    const json = canonicalTickRecordJson({
      v: 1,
      sid: "abcdef0123456789",
      t: 1_800_000_000_000,
      n: 7,
      gap: 5000,
      ipc: "residential",
      f: STATS,
      sc: 842,
      vd: "pay",
      w: 10000,
      a: 1000,
      r: ["IP_TOR", "HIDDEN"],
      sv: "1.0.0",
    });
    const keys = Object.keys(JSON.parse(json));
    expect(keys).toEqual(["v", "sid", "t", "n", "gap", "ipc", "f", "sc", "vd", "w", "a", "r", "sv"]);
  });

  it("sorts the nested bucketed-stats keys alphabetically", () => {
    const json = canonicalTickRecordJson({
      v: 1,
      sid: "abcdef0123456789",
      t: 1,
      n: 1,
      gap: 5000,
      ipc: "residential",
      f: STATS,
      sc: 800,
      vd: "pay",
      w: 10000,
      a: 100,
      r: [],
      sv: "1.0.0",
    });
    const fKeys = Object.keys(JSON.parse(json).f);
    expect(fKeys).toEqual([...fKeys].sort());
  });

  it("sorts reason codes alphabetically regardless of input order", () => {
    const json = canonicalTickRecordJson({
      v: 1,
      sid: "abcdef0123456789",
      t: 1,
      n: 1,
      gap: 5000,
      ipc: "residential",
      f: STATS,
      sc: 300,
      vd: "reject",
      w: 0,
      a: 0,
      r: ["STATS_REPEATING", "GAP_TOO_REGULAR"],
      sv: "1.0.0",
    });
    expect(JSON.parse(json).r).toEqual(["GAP_TOO_REGULAR", "STATS_REPEATING"]);
  });

  it("produces no whitespace", () => {
    const json = canonicalTickRecordJson({
      v: 1,
      sid: "abcdef0123456789",
      t: 1,
      n: 1,
      gap: 5000,
      ipc: "unknown",
      f: STATS,
      sc: 0,
      vd: "reject",
      w: 0,
      a: 0,
      r: [],
      sv: "1.0.0",
    });
    expect(json).not.toMatch(/\s/);
  });
});
