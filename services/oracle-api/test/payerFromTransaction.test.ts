import { describe, expect, it } from "vitest";
import { payerFromTransactionBytes } from "../src/payerFromTransaction.js";

// A real unsigned Sui transaction (produced by `sui client ptb --serialize-unsigned-transaction`
// during this project's own live x402 testing) — its sender is known independently.
const REAL_UNSIGNED_TX_BASE64 =
  "AAADAQDFc2MO070usmXpG7Mo2Gh1vHAmp51yeh03d513ECN+gPN+szgAAAAAIOsr7UoRGADJzj5tZ7F2fXAXJNcEsq1QGQhYKSdl95iDAAgQJwAAAAAAAAAgW6QlXnzC4tKF7tBfQIUKWaRU+bs/m6EXxCTB57h6kB0CAgEAAAEBAQABAQIAAAECAO/DKYa6QxuMdnQiyvDw05W6zgfB8CE+h5x7PpbginvsAW4Ea+WDkD0gB+R/Tgo+eg3BJ/7a9XH5+6dI5V+V389d3ltgPQAAAAAgYHqJHsABZEad4cpgFOKLpgmjoqPOPtwYQfUVB4/+TejvwymGukMbjHZ0Isrw8NOVus4HwfAhPoecez6W4Ip77OgDAAAAAAAAKPlBAAAAAAAA";
const REAL_SENDER = "0xefc32986ba431b8c767422caf0f0d395bace07c1f0213e879c7b3e96e08a7bec";

describe("payerFromTransactionBytes", () => {
  it("decodes the real sender address from real transaction bytes", () => {
    expect(payerFromTransactionBytes(REAL_UNSIGNED_TX_BASE64)).toBe(REAL_SENDER);
  });

  it("returns undefined for garbage input instead of throwing", () => {
    expect(payerFromTransactionBytes("not-valid-base64-tx-bytes")).toBeUndefined();
  });
});
