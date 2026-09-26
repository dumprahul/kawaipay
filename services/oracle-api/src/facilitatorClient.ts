import type { PaymentRequirements } from "./paymentRequirements.js";

export interface PaymentPayload {
  x402Version: number;
  accepted: PaymentRequirements;
  payload: { transaction: string; signature: string };
}

export type VerifyResult = { isValid: true } | { isValid: false; invalidReason: string };
export type SettleResult = { success: true; transaction: string; payer?: string } | { success: false; errorReason: string };

export interface FacilitatorClient {
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResult>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResult>;
}

/**
 * Talks to a real x402 facilitator over HTTP (verified live against
 * https://sui-facilitator.onrender.com: /verify returns `{isValid, invalidReason?}`,
 * /settle returns `{success, payer, transaction, network, amount}` on success — and
 * settling the same signed transaction bytes twice is itself idempotent on the
 * facilitator's side, returning the same digest rather than erroring or double-spending).
 */
export class HttpFacilitatorClient implements FacilitatorClient {
  constructor(private readonly facilitatorUrl: string) {}

  private async post(path: string, payload: PaymentPayload, requirements: PaymentRequirements): Promise<unknown> {
    const res = await fetch(`${this.facilitatorUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: payload.x402Version,
        paymentPayload: payload,
        paymentRequirements: requirements,
      }),
    });
    if (!res.ok) {
      throw new Error(`facilitator ${path} returned HTTP ${res.status}`);
    }
    return res.json();
  }

  async verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResult> {
    const body = (await this.post("/verify", payload, requirements)) as Record<string, unknown>;
    if (body.isValid === true) return { isValid: true };
    return { isValid: false, invalidReason: typeof body.invalidReason === "string" ? body.invalidReason : JSON.stringify(body) };
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResult> {
    const body = (await this.post("/settle", payload, requirements)) as Record<string, unknown>;
    if (body.success === true && typeof body.transaction === "string") {
      return { success: true, transaction: body.transaction, payer: typeof body.payer === "string" ? body.payer : undefined };
    }
    return { success: false, errorReason: typeof body.errorReason === "string" ? body.errorReason : JSON.stringify(body) };
  }
}
