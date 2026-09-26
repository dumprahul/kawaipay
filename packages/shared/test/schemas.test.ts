import { describe, expect, it } from "vitest";
import { heartbeatRequestSchema, oracleVerdictRequestSchema, rawStatsSchema, sessionStartRequestSchema } from "../src/schemas.js";

const VALID_STATS = {
  windowMs: 5000,
  visibleMs: 4000,
  focusedMs: 3000,
  inViewportMs: 2000,
  contentViewportRatio: 0.5,
  scrollEvents: 3,
  scrollDepthPct: 40,
  scrollSpeedMax: 500,
  pointerMoves: 5,
  pointerCells: 10,
  touchEvents: 0,
  keyEvents: 0,
  tabSwitches: 1,
};

describe("rawStatsSchema", () => {
  it("accepts a valid stats object", () => {
    expect(rawStatsSchema.safeParse(VALID_STATS).success).toBe(true);
  });

  it("rejects windowMs outside 3000-8000", () => {
    expect(rawStatsSchema.safeParse({ ...VALID_STATS, windowMs: 2999 }).success).toBe(false);
    expect(rawStatsSchema.safeParse({ ...VALID_STATS, windowMs: 8001 }).success).toBe(false);
  });

  it("rejects visibleMs greater than windowMs", () => {
    expect(rawStatsSchema.safeParse({ ...VALID_STATS, visibleMs: 6000 }).success).toBe(false);
  });

  it("rejects scrollEvents above 5000", () => {
    expect(rawStatsSchema.safeParse({ ...VALID_STATS, scrollEvents: 5001 }).success).toBe(false);
  });
});

describe("sessionStartRequestSchema", () => {
  it("accepts a valid request", () => {
    const req = { linkId: "0x" + "a".repeat(64), client: { tz: "Asia/Tokyo", viewport: [1280, 720] } };
    expect(sessionStartRequestSchema.safeParse(req).success).toBe(true);
  });

  it("rejects a malformed linkId", () => {
    const req = { linkId: "not-a-link-id", client: { tz: "Asia/Tokyo", viewport: [1280, 720] } };
    expect(sessionStartRequestSchema.safeParse(req).success).toBe(false);
  });
});

describe("heartbeatRequestSchema", () => {
  it("accepts a valid heartbeat", () => {
    const req = {
      sessionId: "6f9619ff-8b86-d011-b42d-00cf4fc964ff",
      seq: 1,
      token: "abc",
      stats: VALID_STATS,
      mac: "base64==",
    };
    expect(heartbeatRequestSchema.safeParse(req).success).toBe(true);
  });
});

describe("oracleVerdictRequestSchema", () => {
  const validReq = {
    ticks: [{ gapMs: 5000, stats: VALID_STATS }],
    ipClass: "residential",
  };

  it("accepts a valid request", () => {
    expect(oracleVerdictRequestSchema.safeParse(validReq).success).toBe(true);
  });

  it("rejects extra top-level fields (strict schema)", () => {
    expect(oracleVerdictRequestSchema.safeParse({ ...validReq, extra: "field" }).success).toBe(false);
  });

  it("rejects more than 24 ticks", () => {
    const tooMany = { ...validReq, ticks: Array(25).fill(validReq.ticks[0]) };
    expect(oracleVerdictRequestSchema.safeParse(tooMany).success).toBe(false);
  });

  it("rejects zero ticks", () => {
    expect(oracleVerdictRequestSchema.safeParse({ ...validReq, ticks: [] }).success).toBe(false);
  });

  it("rejects extra fields inside a tick", () => {
    const withExtra = { ...validReq, ticks: [{ gapMs: 5000, stats: VALID_STATS, extra: 1 }] };
    expect(oracleVerdictRequestSchema.safeParse(withExtra).success).toBe(false);
  });
});
