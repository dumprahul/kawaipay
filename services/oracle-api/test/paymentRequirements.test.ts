import { describe, expect, it } from "vitest";
import { buildPaymentRequirements, paymentRequirementsEqual } from "../src/paymentRequirements.js";

const CONFIG = {
  network: "sui:testnet",
  priceBaseUnits: 1000,
  usdcType: "0xusdc::usdc::USDC",
  payTo: "0x" + "aa".repeat(32),
  maxTimeoutSeconds: 60,
};

describe("buildPaymentRequirements", () => {
  it("builds the exact 'exact' scheme shape a real facilitator expects", () => {
    expect(buildPaymentRequirements(CONFIG)).toEqual({
      scheme: "exact",
      network: "sui:testnet",
      amount: "1000",
      asset: "0xusdc::usdc::USDC",
      payTo: "0x" + "aa".repeat(32),
      maxTimeoutSeconds: 60,
      extra: {},
    });
  });
});

describe("paymentRequirementsEqual", () => {
  it("matches on scheme/network/amount/asset/payTo/maxTimeoutSeconds", () => {
    const a = buildPaymentRequirements(CONFIG);
    const b = buildPaymentRequirements(CONFIG);
    expect(paymentRequirementsEqual(a, b)).toBe(true);
  });

  it("rejects a mismatched amount (a client trying to pay less than required)", () => {
    const a = buildPaymentRequirements(CONFIG);
    const b = buildPaymentRequirements({ ...CONFIG, priceBaseUnits: 1 });
    expect(paymentRequirementsEqual(a, b)).toBe(false);
  });

  it("rejects a mismatched payTo", () => {
    const a = buildPaymentRequirements(CONFIG);
    const b = buildPaymentRequirements({ ...CONFIG, payTo: "0x" + "bb".repeat(32) });
    expect(paymentRequirementsEqual(a, b)).toBe(false);
  });
});
