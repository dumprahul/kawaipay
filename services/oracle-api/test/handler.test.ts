import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import type { OracleVerdictRequest } from "@kawaipay/shared";
import { handleOracleVerdictRequest } from "../src/handler.js";
import { buildPaymentRequirements } from "../src/paymentRequirements.js";
import type { PaymentPayload } from "../src/facilitatorClient.js";
import { FakeFacilitatorClient } from "./fakeFacilitator.js";
import { createTestDatabase } from "./testHarness.js";

let pg: Pool;

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

const REQUEST: OracleVerdictRequest = { ticks: [{ gapMs: 5000, stats: STATS }], ipClass: "residential" };

function encodeHeader(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function buildPayload(txBytes: string): PaymentPayload {
  return {
    x402Version: 2,
    accepted: buildPaymentRequirements(CONFIG),
    payload: { transaction: txBytes, signature: "sig-" + txBytes },
  };
}

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_oracle_api_handler_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE used_payments");
});

afterAll(async () => {
  await pg.end();
});

describe("handleOracleVerdictRequest", () => {
  it("returns payment_required with the endpoint's requirements when no payment header is present", async () => {
    const facilitator = new FakeFacilitatorClient();
    const outcome = await handleOracleVerdictRequest({ pg, facilitator, config: CONFIG }, REQUEST, undefined, Date.now());
    expect(outcome.kind).toBe("payment_required");
    if (outcome.kind === "payment_required") {
      expect(outcome.accepts).toEqual([buildPaymentRequirements(CONFIG)]);
    }
    expect(facilitator.verifyCalls).toHaveLength(0);
  });

  it("rejects a malformed X-PAYMENT header without calling the facilitator", async () => {
    const facilitator = new FakeFacilitatorClient();
    const outcome = await handleOracleVerdictRequest({ pg, facilitator, config: CONFIG }, REQUEST, "not-base64-json", Date.now());
    expect(outcome.kind).toBe("malformed_payment");
    expect(facilitator.verifyCalls).toHaveLength(0);
  });

  it("rejects a payment for the wrong amount/asset/payTo without calling the facilitator", async () => {
    const facilitator = new FakeFacilitatorClient();
    const wrongPayload = buildPayload("tx-1");
    wrongPayload.accepted = { ...wrongPayload.accepted, amount: "1" }; // client trying to underpay
    const outcome = await handleOracleVerdictRequest({ pg, facilitator, config: CONFIG }, REQUEST, encodeHeader(wrongPayload), Date.now());
    expect(outcome.kind).toBe("invalid_payment");
    expect(facilitator.verifyCalls).toHaveLength(0);
  });

  it("surfaces the facilitator's invalidReason when /verify rejects the payment", async () => {
    const facilitator = new FakeFacilitatorClient({ verifyResult: { isValid: false, invalidReason: "invalid_transaction_state" } });
    const outcome = await handleOracleVerdictRequest({ pg, facilitator, config: CONFIG }, REQUEST, encodeHeader(buildPayload("tx-2")), Date.now());
    expect(outcome).toEqual({ kind: "invalid_payment", reason: "invalid_transaction_state" });
    expect(facilitator.settleCalls).toHaveLength(0);
  });

  it("surfaces a facilitator settle failure", async () => {
    const facilitator = new FakeFacilitatorClient({ settleResult: { success: false, errorReason: "insufficient_funds" } });
    const outcome = await handleOracleVerdictRequest({ pg, facilitator, config: CONFIG }, REQUEST, encodeHeader(buildPayload("tx-3")), Date.now());
    expect(outcome).toEqual({ kind: "settle_failed", reason: "insufficient_funds" });
  });

  it("scores the request and records the payment once it settles", async () => {
    const facilitator = new FakeFacilitatorClient();
    const outcome = await handleOracleVerdictRequest({ pg, facilitator, config: CONFIG }, REQUEST, encodeHeader(buildPayload("tx-4")), Date.now());
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") throw new Error("unreachable");
    expect(outcome.cached).toBe(false);
    expect(outcome.response.results).toHaveLength(1);

    const { rows } = await pg.query(`SELECT * FROM used_payments WHERE digest = $1`, [outcome.txDigest]);
    expect(rows).toHaveLength(1);
    expect(rows[0].payer).toBe("0xfakepayer");
    expect(rows[0].amount).toBe("1000");
    expect(rows[0].endpoint).toBe("/v1/oracle/verdict");
  });

  it("returns the cached response for a resettled (idempotent) payment, without rescoring", async () => {
    const facilitator = new FakeFacilitatorClient();
    const payload = buildPayload("tx-5"); // same tx bytes both times -> same digest from the fake facilitator
    const header = encodeHeader(payload);

    const first = await handleOracleVerdictRequest({ pg, facilitator, config: CONFIG }, REQUEST, header, Date.now());
    expect(first.kind).toBe("ok");
    if (first.kind !== "ok") throw new Error("unreachable");
    expect(first.cached).toBe(false);

    // A different request body the second time — if caching worked, this must NOT affect the response.
    const differentRequest: OracleVerdictRequest = { ticks: [{ gapMs: 5000, stats: STATS }, { gapMs: 5000, stats: STATS }], ipClass: "datacenter" };
    const second = await handleOracleVerdictRequest({ pg, facilitator, config: CONFIG }, differentRequest, header, Date.now() + 10_000);
    expect(second.kind).toBe("ok");
    if (second.kind !== "ok") throw new Error("unreachable");
    expect(second.cached).toBe(true);
    expect(second.txDigest).toBe(first.txDigest);
    expect(second.response).toEqual(first.response);

    const { rows } = await pg.query(`SELECT count(*)::int AS n FROM used_payments WHERE digest = $1`, [first.txDigest]);
    expect(rows[0].n).toBe(1);
  });
});
