// Ad-hoc live check (not a vitest test — hits the real network): proves
// fetchPayoutSettledEvent genuinely decodes a real, already-settled testnet
// PayoutSettled event, by checking it against the known log_root from the earlier
// live capstone settlement.
import { fetchPayoutSettledEvent } from "../src/chainEvent.ts";

const r = await fetchPayoutSettledEvent(
  "https://graphql.testnet.sui.io/graphql",
  "testnet",
  "6ayXeAnAvpV3E81zgeBQcLxjv78YJW3UNwVQRqRQNrFj",
  "0xc1cd8ba232d6908c082f6334fd6f1c20ec81d58ce6159cc65aa592d8c89a6341",
  0,
);
console.log(r);
console.log("logRoot base64:", Buffer.from(r.logRoot).toString("base64"));
console.log("expected:      ", "uH2gmbRXjM5fPYTbmzkHBK2emQtMqks1iGNDgXO3ZjE=");
console.log("match:", Buffer.from(r.logRoot).toString("base64") === "uH2gmbRXjM5fPYTbmzkHBK2emQtMqks1iGNDgXO3ZjE=");
