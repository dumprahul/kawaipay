import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { computeHeartbeatMac, heartbeatMacMessage } from "@kawaipay/shared";
import { buildApp } from "../src/app.js";
import { createTestDatabase, createTestRedis, seedCampaignAndLink } from "./testHarness.js";

let pg: Pool;
let redis: Redis;
let app: FastifyInstance;

const VALID_STATS = {
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
  pg = await createTestDatabase("kawaipay_gw_app_test");
  redis = createTestRedis();
  app = buildApp({ pg, redis, minLinkBudget: 10_000, tickMs: 5000, sessionTtlMs: 15_000, ipHashSalt: "app-test-salt" });
}, 30_000);

beforeEach(async () => {
  await redis.flushdb();
});

afterAll(async () => {
  await app.close();
  await redis.quit();
  await pg.end();
});

describe("GET /v1/links/:linkId/history", () => {
  it("returns 404 for a link that doesn't exist", async () => {
    const res = await app.inject({ method: "GET", url: `/v1/links/0x${"ff".repeat(32)}/history` });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("LINK_NOT_FOUND");
  });

  it("returns 400 for a malformed linkId", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/links/not-a-link/history" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_REQUEST");
  });

  it("returns a settled link's history, including the on-chain log_root and log_blob_id", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "40".repeat(32) });
    const logRoot = Buffer.alloc(32, 9);
    await pg.query(
      `INSERT INTO settlements (tx_digest, event_seq, link_id, seq, amount, seconds_verified, log_root, checkpoint, ts)
       VALUES ('digest-1', 0, $1, 0, 1500, 60, $2, 12345, now())`,
      [linkId, logRoot],
    );
    const { rows: batchRows } = await pg.query(`INSERT INTO batches (status) VALUES ('confirmed') RETURNING batch_id`);
    await pg.query(
      `INSERT INTO batch_items (batch_id, link_id, seq, amount, seconds_verified, log_root, expires_at_ms, signature, log_blob_id, status)
       VALUES ($1, $2, 0, 1500, 60, $3, $4, '\\x00', $5, 'confirmed')`,
      [Number(batchRows[0].batch_id), linkId, logRoot, Date.now() + 60_000, `logs/${linkId}/0.jsonl`],
    );

    const res = await app.inject({ method: "GET", url: `/v1/links/${linkId}/history` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.linkId).toBe(linkId);
    expect(body.settlements).toEqual([
      {
        seq: 0,
        amount: 1500,
        secondsVerified: 60,
        logRoot: logRoot.toString("hex"),
        logBlobId: `logs/${linkId}/0.jsonl`,
        txDigest: "digest-1",
        checkpoint: 12345,
        settledAt: expect.any(String),
      },
    ]);
    expect(body.nextBeforeSeq).toBeNull();
  });
});

describe("GET /health", () => {
  it("responds ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe("GET /metrics", () => {
  it("exposes Prometheus text format and reflects real request activity", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "41".repeat(32) });
    await app.inject({ method: "POST", url: "/v1/session/start", payload: { linkId, client: { tz: "UTC", viewport: [800, 600] } } });

    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain('gateway_sessions_started_total{tracking="true"} 1');
  });
});

describe("full session-start -> heartbeat flow over HTTP", () => {
  it("starts a session and scores a valid heartbeat end-to-end", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "30".repeat(32) });

    const startRes = await app.inject({
      method: "POST",
      url: "/v1/session/start",
      payload: { linkId, client: { tz: "Asia/Tokyo", viewport: [1280, 720] } },
    });
    expect(startRes.statusCode).toBe(200);
    const startBody = startRes.json();
    expect(startBody.tracking).toBe(true);

    const secret = Buffer.from(startBody.secret, "base64");
    const mac = computeHeartbeatMac(secret, heartbeatMacMessage(startBody.sessionId, 1, startBody.token, VALID_STATS));

    const hbRes = await app.inject({
      method: "POST",
      url: "/v1/heartbeat",
      payload: { sessionId: startBody.sessionId, seq: 1, token: startBody.token, stats: VALID_STATS, mac },
    });
    expect(hbRes.statusCode).toBe(200);
    const hbBody = hbRes.json();
    expect(Object.keys(hbBody).sort()).toEqual(["nextSeq", "nextToken", "ok"]);
    expect(hbBody.ok).toBe(true);
    expect(hbBody.nextSeq).toBe(2);

    const { rows } = await pg.query("SELECT amount FROM ticks WHERE session_id = $1", [startBody.sessionId]);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBeGreaterThan(0);
  });

  it("returns tracking:false over HTTP for an unknown link, with no session created", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/session/start",
      payload: { linkId: "0x" + "ff".repeat(32), client: { tz: "UTC", viewport: [800, 600] } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tracking: false, reason: "LINK_NOT_FOUND" });
  });

  it("returns 400 for a malformed session/start body", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/session/start", payload: { linkId: "not-valid" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_REQUEST");
  });

  it("rejects a heartbeat with a bad MAC over HTTP", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "31".repeat(32) });
    const startRes = await app.inject({
      method: "POST",
      url: "/v1/session/start",
      payload: { linkId, client: { tz: "UTC", viewport: [800, 600] } },
    });
    const startBody = startRes.json();

    const hbRes = await app.inject({
      method: "POST",
      url: "/v1/heartbeat",
      payload: { sessionId: startBody.sessionId, seq: 1, token: startBody.token, stats: VALID_STATS, mac: "totally-wrong" },
    });
    expect(hbRes.statusCode).toBe(401);
    expect(hbRes.json().error.code).toBe("BAD_MAC");
  });

  it("returns 200 with ok:false LINK_INACTIVE for a heartbeat against a since-frozen link", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "32".repeat(32) });
    const startRes = await app.inject({
      method: "POST",
      url: "/v1/session/start",
      payload: { linkId, client: { tz: "UTC", viewport: [800, 600] } },
    });
    const startBody = startRes.json();

    await pg.query("UPDATE links SET frozen = true WHERE link_id = $1", [linkId]);

    const secret = Buffer.from(startBody.secret, "base64");
    const mac = computeHeartbeatMac(secret, heartbeatMacMessage(startBody.sessionId, 1, startBody.token, VALID_STATS));
    const hbRes = await app.inject({
      method: "POST",
      url: "/v1/heartbeat",
      payload: { sessionId: startBody.sessionId, seq: 1, token: startBody.token, stats: VALID_STATS, mac },
    });
    expect(hbRes.statusCode).toBe(200);
    expect(hbRes.json()).toEqual({ ok: false, reason: "LINK_INACTIVE" });
  });
});
