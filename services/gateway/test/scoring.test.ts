import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { scoreAndPersistHeartbeat } from "../src/scoring.js";
import { createSession, getSession } from "../src/sessionStore.js";
import { getLinkMirror } from "../src/mirror.js";
import { createTestDatabase, createTestRedis, seedCampaignAndLink } from "./testHarness.js";

let pg: Pool;
let redis: Redis;

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

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_gw_scoring_test");
  redis = createTestRedis();
}, 30_000);

beforeEach(async () => {
  await redis.flushdb();
});

afterAll(async () => {
  await redis.quit();
  await pg.end();
});

describe("scoreAndPersistHeartbeat", () => {
  it("scores a human-like tick, persists it, updates accruals, and never leaks the score to the response", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "20".repeat(32), ratePerSecond: 200, maxRatePerSecond: 1000 });
    const nowMs = 1_800_000_000_000;
    const { sessionId, token } = await createSession(redis, linkId, "src-hash-1", "residential", nowMs);
    // Postgres sessions row must exist for the ticks FK.
    await pg.query(
      `INSERT INTO sessions (session_id, link_id, started_at, last_seen_at, ip_hash, ip_class) VALUES ($1, $2, now(), now(), '\\x00', 'residential')`,
      [sessionId, linkId],
    );

    const session = await getSession(redis, sessionId);
    const link = await getLinkMirror(pg, linkId);
    if (!session || !link) throw new Error("fixture setup failed");

    const response = await scoreAndPersistHeartbeat(pg, redis, {
      sessionId,
      session,
      link,
      seq: 1,
      stats: HUMAN_LIKE_STATS,
      serverGapMs: 5000,
      nowMs,
    });

    // The response must be exactly {ok, nextSeq, nextToken} — no score/verdict/weight/amount.
    expect(Object.keys(response).sort()).toEqual(["nextSeq", "nextToken", "ok"]);
    expect(response.ok).toBe(true);
    expect(response.nextSeq).toBe(2);
    expect(response.nextToken).not.toBe(token);

    const { rows: tickRows } = await pg.query("SELECT * FROM ticks WHERE session_id = $1", [sessionId]);
    expect(tickRows).toHaveLength(1);
    expect(tickRows[0].verdict).toBe("pay");
    // This is the link's first-ever tick, so warm-up (0.5x) applies on top of the pay
    // verdict's 1.0 weight: rate 200 * 5s * (1.0 verdict * 0.5 warmup) = 500.
    expect(Number(tickRows[0].amount)).toBe(500);

    const { rows: accrualRows } = await pg.query("SELECT * FROM accruals WHERE link_id = $1", [linkId]);
    expect(Number(accrualRows[0].earned_total)).toBe(500);
    expect(Number(accrualRows[0].settled_total)).toBe(0);

    const { rows: sessionRows } = await pg.query("SELECT tick_count FROM sessions WHERE session_id = $1", [sessionId]);
    expect(sessionRows[0].tick_count).toBe(1);

    const advancedSession = await getSession(redis, sessionId);
    expect(advancedSession?.expectedSeq).toBe(2);
    expect(advancedSession?.sessionSecondsPaid).toBe(5);
  });

  it("accumulates accruals.earned_total across multiple ticks for the same link", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "21".repeat(32), ratePerSecond: 100, maxRatePerSecond: 1000 });
    const nowMs = 1_800_000_000_000;

    for (let i = 0; i < 2; i++) {
      const t = nowMs + i * 5000;
      const { sessionId } = await createSession(redis, linkId, "src-hash-2", "residential", t);
      await pg.query(
        `INSERT INTO sessions (session_id, link_id, started_at, last_seen_at, ip_hash, ip_class) VALUES ($1, $2, now(), now(), '\\x00', 'residential')`,
        [sessionId, linkId],
      );
      const session = await getSession(redis, sessionId);
      const link = await getLinkMirror(pg, linkId);
      if (!session || !link) throw new Error("fixture setup failed");
      await scoreAndPersistHeartbeat(pg, redis, { sessionId, session, link, seq: 1, stats: HUMAN_LIKE_STATS, serverGapMs: 5000, nowMs: t });
    }

    const { rows } = await pg.query("SELECT earned_total FROM accruals WHERE link_id = $1", [linkId]);
    // Both ticks land within the 24h warm-up window: rate 100 * 5s * 0.5 warmup = 250 each.
    expect(Number(rows[0].earned_total)).toBe(500);
  });

  it("scores a scripted-looking tick down to near zero (low weight, low amount)", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "22".repeat(32), ratePerSecond: 200, maxRatePerSecond: 1000 });
    const nowMs = 1_800_000_000_000;
    const { sessionId } = await createSession(redis, linkId, "src-hash-3", "datacenter", nowMs);
    await pg.query(
      `INSERT INTO sessions (session_id, link_id, started_at, last_seen_at, ip_hash, ip_class) VALUES ($1, $2, now(), now(), '\\x00', 'datacenter')`,
      [sessionId, linkId],
    );
    const session = await getSession(redis, sessionId);
    const link = await getLinkMirror(pg, linkId);
    if (!session || !link) throw new Error("fixture setup failed");

    const noInteractionStats = { ...HUMAN_LIKE_STATS, scrollEvents: 0, pointerMoves: 0 };
    await scoreAndPersistHeartbeat(pg, redis, { sessionId, session, link, seq: 1, stats: noInteractionStats, serverGapMs: 5000, nowMs });

    const { rows } = await pg.query("SELECT amount, verdict FROM ticks WHERE session_id = $1", [sessionId]);
    // NO_INTERACTION_LONG(0.15) + IP_DATACENTER(0.30) on top of presence-only base.
    expect(Number(rows[0].amount)).toBeLessThan(1000);
  });
});
