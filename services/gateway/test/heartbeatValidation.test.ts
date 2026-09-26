import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { computeHeartbeatMac, heartbeatMacMessage } from "@kawaipay/shared";
import { validateHeartbeat, type HeartbeatValidationDeps } from "../src/heartbeatValidation.js";
import { createSession } from "../src/sessionStore.js";
import { createTestDatabase, createTestRedis, seedCampaignAndLink } from "./testHarness.js";

let pg: Pool;
let redis: Redis;
let deps: HeartbeatValidationDeps;

const VALID_STATS = {
  windowMs: 5000,
  visibleMs: 5000,
  focusedMs: 5000,
  inViewportMs: 5000,
  contentViewportRatio: 0.8,
  scrollEvents: 3,
  scrollDepthPct: 40,
  scrollSpeedMax: 500,
  pointerMoves: 5,
  pointerCells: 10,
  touchEvents: 0,
  keyEvents: 0,
  tabSwitches: 1,
};

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_gw_heartbeat_validation_test");
  redis = createTestRedis();
  deps = { redis, pg, minLinkBudget: 10_000 };
}, 30_000);

beforeEach(async () => {
  await redis.flushdb();
});

afterAll(async () => {
  await redis.quit();
  await pg.end();
});

async function freshSession(linkId: string, nowMs: number) {
  return createSession(redis, linkId, "ip-hash-abc", "residential", nowMs);
}

function macFor(sessionId: string, seq: number, token: string, secret: Uint8Array, stats: typeof VALID_STATS) {
  return computeHeartbeatMac(Buffer.from(secret), heartbeatMacMessage(sessionId, seq, token, stats));
}

describe("validateHeartbeat", () => {
  it("returns error 400 INVALID_REQUEST for a malformed body", async () => {
    const result = await validateHeartbeat(deps, { not: "a heartbeat" }, Date.now());
    expect(result).toEqual({ kind: "error", status: 400, code: "INVALID_REQUEST" });
  });

  it("returns error 410 SESSION_EXPIRED when the session isn't in Redis", async () => {
    const body = { sessionId: "00000000-0000-0000-0000-000000000000", seq: 1, token: "t", stats: VALID_STATS, mac: "x" };
    const result = await validateHeartbeat(deps, body, Date.now());
    expect(result).toEqual({ kind: "error", status: 410, code: "SESSION_EXPIRED" });
  });

  it("accepts a fully valid heartbeat and returns the link + computed server gap", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "10".repeat(32) });
    const startMs = 1_800_000_000_000;
    const { sessionId, secret, token } = await freshSession(linkId, startMs);

    const nowMs = startMs + 5000;
    const mac = macFor(sessionId, 1, token, secret, VALID_STATS);
    const body = { sessionId, seq: 1, token, stats: VALID_STATS, mac };

    const result = await validateHeartbeat(deps, body, nowMs);
    expect(result.kind).toBe("valid");
    if (result.kind !== "valid") throw new Error("expected valid");
    expect(result.link.linkId).toBe(linkId);
    expect(result.serverGapMs).toBe(5000);
  });

  it("returns error 401 BAD_MAC for a tampered stats object", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "11".repeat(32) });
    const nowMs = Date.now();
    const { sessionId, secret, token } = await freshSession(linkId, nowMs);
    const mac = macFor(sessionId, 1, token, secret, VALID_STATS);
    const tampered = { ...VALID_STATS, scrollEvents: 999 };

    const result = await validateHeartbeat(deps, { sessionId, seq: 1, token, stats: tampered, mac }, nowMs);
    expect(result).toEqual({ kind: "error", status: 401, code: "BAD_MAC" });
  });

  it("returns error 409 BAD_SEQ when seq does not match the expected value", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "12".repeat(32) });
    const nowMs = Date.now();
    const { sessionId, secret, token } = await freshSession(linkId, nowMs);
    const mac = macFor(sessionId, 5, token, secret, VALID_STATS); // session expects seq=1

    const result = await validateHeartbeat(deps, { sessionId, seq: 5, token, stats: VALID_STATS, mac }, nowMs);
    expect(result).toEqual({ kind: "error", status: 409, code: "BAD_SEQ" });
  });

  it("returns error 401 BAD_TOKEN when the token doesn't match the last issued one", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "13".repeat(32) });
    const nowMs = Date.now();
    const { sessionId, secret } = await freshSession(linkId, nowMs);
    const wrongToken = "wrong-token";
    const mac = macFor(sessionId, 1, wrongToken, secret, VALID_STATS);

    const result = await validateHeartbeat(deps, { sessionId, seq: 1, token: wrongToken, stats: VALID_STATS, mac }, nowMs);
    expect(result).toEqual({ kind: "error", status: 401, code: "BAD_TOKEN" });
  });

  it("returns error 422 IMPLAUSIBLE_PAYLOAD for out-of-range stats", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "14".repeat(32) });
    const nowMs = Date.now();
    const { sessionId, secret, token } = await freshSession(linkId, nowMs);
    const badStats = { ...VALID_STATS, windowMs: 100 }; // below the 3000-8000 range
    const mac = macFor(sessionId, 1, token, secret, badStats);

    const result = await validateHeartbeat(deps, { sessionId, seq: 1, token, stats: badStats, mac }, nowMs);
    expect(result).toEqual({ kind: "error", status: 422, code: "IMPLAUSIBLE_PAYLOAD" });
  });

  it("returns link_inactive (not an error) when the link is frozen", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "15".repeat(32), frozen: true });
    const nowMs = Date.now();
    const { sessionId, secret, token } = await freshSession(linkId, nowMs);
    const mac = macFor(sessionId, 1, token, secret, VALID_STATS);

    const result = await validateHeartbeat(deps, { sessionId, seq: 1, token, stats: VALID_STATS, mac }, nowMs);
    expect(result).toEqual({ kind: "link_inactive" });
  });

  it("rate-limits heartbeats per session", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "16".repeat(32) });
    const nowMs = Date.now();
    const { sessionId, secret, token } = await freshSession(linkId, nowMs);
    const mac = macFor(sessionId, 1, token, secret, VALID_STATS);
    const body = { sessionId, seq: 1, token, stats: VALID_STATS, mac };

    let lastResult;
    for (let i = 0; i < 31; i++) {
      lastResult = await validateHeartbeat(deps, body, nowMs);
    }
    expect(lastResult).toEqual({ kind: "error", status: 429, code: "RATE_LIMITED" });
  });
});
