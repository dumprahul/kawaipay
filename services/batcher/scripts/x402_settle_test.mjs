// A real x402 /settle call against the live facilitator — THIS ONE BROADCASTS.
// It actually moves 0.01 testnet USDC from your wallet to PAY_TO. Run it
// yourself; it is not something that should be executed on your behalf.
//
// Before running this, regenerate fresh unsigned tx bytes + signature (the
// coin object's version must still be current):
//
//   USDC_COIN=0xc573630ed3bd2eb265e91bb328d86875bc7026a79d727a1d37779d7710237e80
//   PAYTO=0x5ba4255e7cc2e2d285eed05f40850a59a454f9bb3f9ba117c424c1e7b87a901d
//   sui client ptb \
//     --split-coins "@${USDC_COIN}" "[10000]" \
//     --assign payment \
//     --transfer-objects "[payment]" "@${PAYTO}" \
//     --serialize-unsigned-transaction > /tmp/unsigned_tx.txt
//
//   MY_ADDR=0xefc32986ba431b8c767422caf0f0d395bace07c1f0213e879c7b3e96e08a7bec
//   sui keytool sign --address "$MY_ADDR" --data "$(cat /tmp/unsigned_tx.txt)" --json > /tmp/sign_output.json
//
// Then: node services/batcher/scripts/x402_settle_test.mjs
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

console.log("POST", `${FACILITATOR_URL}/settle`);
console.log("This will broadcast a real transaction. Payer:", signOutput.suiAddress);
console.log("Amount: 10000 base units (0.01 USDC) -> ", PAY_TO);

const res = await fetch(`${FACILITATOR_URL}/settle`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const result = await res.json();
console.log("\nHTTP status:", res.status);
console.log("Response:", JSON.stringify(result, null, 2));

if (result.success && result.transaction) {
  console.log(`\nCheck it: https://testnet.suivision.xyz/txblock/${result.transaction}`);
}
