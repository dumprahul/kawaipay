// Ad-hoc live check (not a vitest test): runs the real oracle-api app in-process, backed
// by a real scratch Postgres database and the REAL HttpFacilitatorClient (not a fake),
// and sends it a real X-PAYMENT header built from a real signed Sui transaction — proving
// the whole request -> decode header -> facilitator /verify round trip works against the
// actual live facilitator, without ever calling /settle (so nothing gets broadcast).
import { readFileSync } from "node:fs";
import { Client, Pool } from "pg";
import { buildApp } from "../src/app.ts";
import { HttpFacilitatorClient } from "../src/facilitatorClient.ts";
import { buildPaymentRequirements } from "../src/paymentRequirements.ts";

const ADMIN_URL = "postgres://localhost/postgres";
const dbName = "kawaipay_oracle_api_live_check";
const admin = new Client({ connectionString: ADMIN_URL });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
await admin.query(`CREATE DATABASE ${dbName}`);
await admin.end();

const url = new URL(ADMIN_URL);
url.pathname = `/${dbName}`;
const pg = new Pool({ connectionString: url.toString() });
await pg.query(readFileSync(new URL("../../../db/migrations/0001_init.sql", import.meta.url), "utf8"));

const config = {
  network: "sui:testnet",
  priceBaseUnits: 10000, // matches the real signed tx's amount below
  usdcType: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
  payTo: "0x5ba4255e7cc2e2d285eed05f40850a59a454f9bb3f9ba117c424c1e7b87a901d",
  maxTimeoutSeconds: 60,
};
const facilitator = new HttpFacilitatorClient("https://sui-facilitator.onrender.com");
const app = buildApp({ pg, facilitator, config });

const transactionBase64 = readFileSync("/tmp/unsigned_tx.txt", "utf8").trim();
const signOutput = JSON.parse(readFileSync("/tmp/sign_output.json", "utf8"));

const paymentPayload = {
  x402Version: 2,
  accepted: buildPaymentRequirements(config),
  payload: { transaction: transactionBase64, signature: signOutput.suiSignature },
};
const header = Buffer.from(JSON.stringify(paymentPayload), "utf8").toString("base64");

const res = await app.inject({
  method: "POST",
  url: "/v1/oracle/verdict",
  headers: { "x-payment": header },
  payload: { ticks: [{ gapMs: 5000, stats: { windowMs: 5000, visibleMs: 5000, focusedMs: 5000, inViewportMs: 5000, contentViewportRatio: 1, scrollEvents: 3, scrollDepthPct: 40, scrollSpeedMax: 500, pointerMoves: 10, pointerCells: 10, touchEvents: 0, keyEvents: 0, tabSwitches: 0 } }], ipClass: "residential" },
});

console.log("HTTP status:", res.statusCode);
console.log(JSON.stringify(res.json(), null, 2));

await app.close();
await pg.end();
