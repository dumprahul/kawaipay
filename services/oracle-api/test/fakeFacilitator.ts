import type { FacilitatorClient, PaymentPayload, SettleResult, VerifyResult } from "../src/facilitatorClient.js";
import type { PaymentRequirements } from "../src/paymentRequirements.js";

/** In-memory FacilitatorClient test double. Settling the same tx bytes twice returns the
 * same digest, mirroring the real facilitator's own idempotent behavior (verified live). */
export class FakeFacilitatorClient implements FacilitatorClient {
  verifyCalls: { payload: PaymentPayload; requirements: PaymentRequirements }[] = [];
  settleCalls: { payload: PaymentPayload; requirements: PaymentRequirements }[] = [];
  private readonly digestsByTxBytes = new Map<string, string>();
  private nextDigestSuffix = 0;

  constructor(
    private opts: {
      verifyResult?: VerifyResult;
      settleResult?: SettleResult | ((payload: PaymentPayload) => SettleResult);
    } = {},
  ) {}

  async verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResult> {
    this.verifyCalls.push({ payload, requirements });
    return this.opts.verifyResult ?? { isValid: true };
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResult> {
    this.settleCalls.push({ payload, requirements });
    if (this.opts.settleResult) {
      return typeof this.opts.settleResult === "function" ? this.opts.settleResult(payload) : this.opts.settleResult;
    }
    const txBytes = payload.payload.transaction;
    let digest = this.digestsByTxBytes.get(txBytes);
    if (!digest) {
      digest = `fake-digest-${this.nextDigestSuffix++}`;
      this.digestsByTxBytes.set(txBytes, digest);
    }
    return { success: true, transaction: digest, payer: "0xfakepayer" };
  }
}
