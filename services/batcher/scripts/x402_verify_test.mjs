// A real x402 /verify call against the live facilitator — read-only, no funds move.
// The transaction bytes + signature were produced by the Sui CLI itself
// (`sui client ptb ... --serialize-unsigned-transaction` + `sui keytool sign`),
// so this script never touches the private key.
import { readFileSync } from "node:fs";

const FACILITATOR_URL = "https://sui-facilitator.onrender.com";
const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
const PAY_TO = "0x5ba4255e7cc2e2d285eed05f40850a59a454f9bb3f9ba117c424c1e7b87a901d";

const transactionBase64 = readFileSync("/tmp/unsigned_tx.txt", "utf8").trim();
const signOutput = JSON.parse(readFileSync("/tmp/sign_output.json", "utf8"));
const signatureBase64 = signOutput.suiSignature;

const accepted = {
  scheme: "exact",
  network: "sui:testnet",
  amount: "10000", // 0.01 USDC, 6 decimals
  asset: USDC_TYPE,
  payTo: PAY_TO,
  maxTimeoutSeconds: 60,
  extra: {},
};

const body = {
  x402Version: 2,
  paymentPayload: {
    x402Version: 2,
    accepted,
    payload: {
      transaction: transactionBase64,
      signature: signatureBase64,
    },
  },
  paymentRequirements: accepted,
};

console.log("POST", `${FACILITATOR_URL}/verify`);
console.log("Request body:", JSON.stringify(body, null, 2));

const res = await fetch(`${FACILITATOR_URL}/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

console.log("\nHTTP status:", res.status);
console.log("Response:", JSON.stringify(await res.json(), null, 2));
