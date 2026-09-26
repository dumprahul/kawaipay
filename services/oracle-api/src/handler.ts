import type { Pool } from "pg";
import type { OracleVerdictRequest } from "@kawaipay/shared";
import type { FacilitatorClient, PaymentPayload } from "./facilitatorClient.js";
import { buildPaymentRequirements, paymentRequirementsEqual, type PaymentRequirements, type PaymentRequirementsConfig } from "./paymentRequirements.js";
import { payerFromTransactionBytes } from "./payerFromTransaction.js";
import { scoreVerdictRequest, type OracleVerdictResponse } from "./verdict.js";

const ENDPOINT = "/v1/oracle/verdict";

export type OracleVerdictOutcome =
  | { kind: "payment_required"; accepts: PaymentRequirements[] }
  | { kind: "malformed_payment"; message: string }
  | { kind: "invalid_payment"; reason: string }
  | { kind: "settle_failed"; reason: string }
  | { kind: "ok"; response: OracleVerdictResponse; cached: boolean; txDigest: string };

/** Decodes the base64 JSON X-PAYMENT header (x402's convention for carrying a PaymentPayload). */
function decodePaymentHeader(header: string): PaymentPayload | null {
  try {
    const json = Buffer.from(header, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed?.payload?.transaction || !parsed?.payload?.signature || !parsed?.accepted) return null;
    return parsed as PaymentPayload;
  } catch {
    return null;
  }
}

/**
 * The full x402-gated flow for POST /v1/oracle/verdict (spec section 12, ticket I1):
 * no payment -> 402 with what we accept; a payment that doesn't match what we charge,
 * or that the facilitator rejects, -> an error outcome; a payment that settles -> the
 * real oracle-core verdict, cached in `used_payments` keyed by the settlement's tx
 * digest so a retried request with the same (already-settled) payment gets back the
 * exact same response instead of being scored twice.
 */
export async function handleOracleVerdictRequest(
  deps: { pg: Pool; facilitator: FacilitatorClient; config: PaymentRequirementsConfig },
  body: OracleVerdictRequest,
  paymentHeader: string | undefined,
  nowMs: number,
): Promise<OracleVerdictOutcome> {
  const requirements = buildPaymentRequirements(deps.config);

  if (!paymentHeader) {
    return { kind: "payment_required", accepts: [requirements] };
  }

  const payload = decodePaymentHeader(paymentHeader);
  if (!payload) {
    return { kind: "malformed_payment", message: "X-PAYMENT header is not a valid base64-encoded payment payload" };
  }
  if (!paymentRequirementsEqual(payload.accepted, requirements)) {
    return { kind: "invalid_payment", reason: "payment does not match this endpoint's required scheme/amount/asset/payTo" };
  }

  const verifyResult = await deps.facilitator.verify(payload, requirements);
  if (!verifyResult.isValid) {
    return { kind: "invalid_payment", reason: verifyResult.invalidReason };
  }

  const settleResult = await deps.facilitator.settle(payload, requirements);
  if (!settleResult.success) {
    return { kind: "settle_failed", reason: settleResult.errorReason };
  }

  const txDigest = settleResult.transaction;
  const { rows: existing } = await deps.pg.query(`SELECT response FROM used_payments WHERE digest = $1`, [txDigest]);
  if (existing.length > 0) {
    return { kind: "ok", response: existing[0].response as OracleVerdictResponse, cached: true, txDigest };
  }

  const response = scoreVerdictRequest(body, nowMs);
  const payer = settleResult.payer ?? payerFromTransactionBytes(payload.payload.transaction) ?? "unknown";
  await deps.pg.query(
    `INSERT INTO used_payments (digest, payer, amount, endpoint, response) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (digest) DO NOTHING`,
    [txDigest, payer, Number(requirements.amount), ENDPOINT, JSON.stringify(response)],
  );

  return { kind: "ok", response, cached: false, txDigest };
}
