import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { buildApp } from "../src/app.js";
import { buildPaymentRequirements } from "../src/paymentRequirements.js";
import type { PaymentPayload } from "../src/facilitatorClient.js";
import { FakeFacilitatorClient } from "./fakeFacilitator.js";
import { createTestDatabase } from "./testHarness.js";

let pg: Pool;
let app: FastifyInstance;
let facilitator: FakeFacilitatorClient;

const CONFIG = {
  network: "sui:testnet",
  priceBaseUnits: 1000,
  usdcType: "0xusdc::usdc::USDC",
  payTo: "0x" + "aa".repeat(32),
  maxTimeoutSeconds: 60,
};

const STATS = {
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

function encodeHeader(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_oracle_api_app_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE used_payments");
  facilitator = new FakeFacilitatorClient();
  app = buildApp({ pg, facilitator, config: CONFIG });
});

afterAll(async () => {
  await pg.end();
});

describe("GET /health", () => {
  it("responds ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe("GET /metrics", () => {
  it("reflects a real request's outcome", async () => {
    await app.inject({ method: "POST", url: "/v1/oracle/verdict", payload: { ticks: [{ gapMs: 5000, stats: STATS }], ipClass: "residential" } });
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('oracle_api_verdict_requests_total{outcome="payment_required"} 1');
  });
});

describe("POST /v1/oracle/verdict", () => {
  it("returns 400 for a malformed body", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/oracle/verdict", payload: { ticks: [] } });
    expect(res.statusCode).toBe(400);
  });

  it("returns 402 with payment requirements when no X-PAYMENT header is sent", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/oracle/verdict",
      payload: { ticks: [{ gapMs: 5000, stats: STATS }], ipClass: "residential" },
    });
    expect(res.statusCode).toBe(402);
    const body = res.json();
    expect(body.accepts).toEqual([buildPaymentRequirements(CONFIG)]);
  });

  it("scores and returns 200 with a valid payment, setting X-PAYMENT-RESPONSE", async () => {
    const payload: PaymentPayload = {
      x402Version: 2,
      accepted: buildPaymentRequirements(CONFIG),
      payload: { transaction: "tx-http-1", signature: "sig-http-1" },
    };
    const res = await app.inject({
      method: "POST",
      url: "/v1/oracle/verdict",
      headers: { "x-payment": encodeHeader(payload) },
      payload: { ticks: [{ gapMs: 5000, stats: STATS }], ipClass: "residential" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toHaveLength(1);
    expect(res.headers["x-payment-response"]).toBeDefined();
  });

  it("returns 402 when the facilitator rejects the payment", async () => {
    facilitator = new FakeFacilitatorClient({ verifyResult: { isValid: false, invalidReason: "expired" } });
    app = buildApp({ pg, facilitator, config: CONFIG });
    const payload: PaymentPayload = {
      x402Version: 2,
      accepted: buildPaymentRequirements(CONFIG),
      payload: { transaction: "tx-http-2", signature: "sig-http-2" },
    };
    const res = await app.inject({
      method: "POST",
      url: "/v1/oracle/verdict",
      headers: { "x-payment": encodeHeader(payload) },
      payload: { ticks: [{ gapMs: 5000, stats: STATS }], ipClass: "residential" },
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().error).toBe("expired");
  });
});
