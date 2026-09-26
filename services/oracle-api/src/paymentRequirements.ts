export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

export interface PaymentRequirementsConfig {
  network: string;
  priceBaseUnits: number;
  usdcType: string;
  payTo: string;
  maxTimeoutSeconds: number;
}

/**
 * The x402 `exact` scheme payment requirements this endpoint charges (spec section 12).
 * One flat price per request regardless of how many ticks are submitted (up to the
 * schema's max of 24) — simpler for callers to reason about than a per-tick meter, and
 * this endpoint's cost is dominated by the on-chain settlement, not the scoring itself.
 */
export function buildPaymentRequirements(config: PaymentRequirementsConfig): PaymentRequirements {
  return {
    scheme: "exact",
    network: config.network,
    amount: String(config.priceBaseUnits),
    asset: config.usdcType,
    payTo: config.payTo,
    maxTimeoutSeconds: config.maxTimeoutSeconds,
    extra: {},
  };
}

export function paymentRequirementsEqual(a: PaymentRequirements, b: PaymentRequirements): boolean {
  return (
    a.scheme === b.scheme &&
    a.network === b.network &&
    a.amount === b.amount &&
    a.asset === b.asset &&
    a.payTo === b.payTo &&
    a.maxTimeoutSeconds === b.maxTimeoutSeconds
  );
}
