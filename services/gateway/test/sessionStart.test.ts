import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { startSession, type SessionStartDeps } from "../src/sessionStart.js";
import { getSession } from "../src/sessionStore.js";
import { createTestDatabase, createTestRedis, seedCampaignAndLink } from "./testHarness.js";

let pg: Pool;
let redis: Redis;
let deps: SessionStartDeps;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_gw_session_start_test");
  redis = createTestRedis();
  deps = { redis, pg, minLinkBudget: 10_000, tickMs: 5000, sessionTtlMs: 15_000, ipHashSalt: "test-salt" };
}, 30_000);

beforeEach(async () => {
  await redis.flushdb();
});

afterAll(async () => {
  await redis.quit();
  await pg.end();
});

describe("startSession", () => {
  it("opens a session for a valid, funded, open link", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "01".repeat(32) });
    const result = await startSession(deps, linkId, "1.2.3.4", Date.now());

    expect(result.tracking).toBe(true);
    if (!result.tracking) throw new Error("expected tracking:true");
    expect(result.heartbeatIntervalMs).toBe(5000);
    expect(result.sessionTtlMs).toBe(15_000);

    const session = await getSession(redis, result.sessionId);
    expect(session).not.toBeNull();
    expect(session?.linkId).toBe(linkId);
    expect(session?.expectedSeq).toBe(1);

    const { rows } = await pg.query("SELECT * FROM sessions WHERE session_id = $1", [result.sessionId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].link_id).toBe(linkId);
  });

  it("never persists the raw IP anywhere in Postgres", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "02".repeat(32) });
    const result = await startSession(deps, linkId, "9.9.9.9", Date.now());
    if (!result.tracking) throw new Error("expected tracking:true");

    const { rows } = await pg.query("SELECT ip_hash FROM sessions WHERE session_id = $1", [result.sessionId]);
    expect(rows[0].ip_hash.toString("hex")).not.toContain("9.9.9.9");
  });

  it("returns tracking:false for a nonexistent link", async () => {
    const result = await startSession(deps, "0x" + "ff".repeat(32), "1.2.3.4", Date.now());
    expect(result).toEqual({ tracking: false, reason: "LINK_NOT_FOUND" });
  });

  it("returns tracking:false for a frozen link", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "03".repeat(32), frozen: true });
    const result = await startSession(deps, linkId, "1.2.3.4", Date.now());
    expect(result).toEqual({ tracking: false, reason: "LINK_FROZEN" });
  });

  it("returns tracking:false for an inactive campaign", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "04".repeat(32), active: false });
    const result = await startSession(deps, linkId, "1.2.3.4", Date.now());
    expect(result).toEqual({ tracking: false, reason: "CAMPAIGN_INACTIVE" });
  });

  it("returns tracking:false when budget is below the minimum", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "05".repeat(32), budgetRemaining: 100 });
    const result = await startSession(deps, linkId, "1.2.3.4", Date.now());
    expect(result).toEqual({ tracking: false, reason: "BUDGET_TOO_LOW" });
  });

  it("rate-limits session starts per source", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "06".repeat(32) });
    const nowMs = Date.now();
    let lastResult;
    for (let i = 0; i < 11; i++) {
      lastResult = await startSession(deps, linkId, "5.5.5.5", nowMs);
    }
    expect(lastResult).toEqual({ tracking: false, reason: "RATE_LIMITED" });
  });

  it("caps concurrent sessions per source per link", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "07".repeat(32) });
    const nowMs = Date.now();
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await startSession(deps, linkId, "6.6.6.6", nowMs));
    }
    expect(results[0]!.tracking).toBe(true);
    expect(results[1]!.tracking).toBe(true);
    expect(results[2]!.tracking).toBe(true);
    expect(results[3]).toEqual({ tracking: false, reason: "TOO_MANY_CONCURRENT_SESSIONS" });
  });
});
