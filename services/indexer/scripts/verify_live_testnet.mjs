// Manual smoke check against real testnet — not part of `pnpm test` (needs network +
// our specific deployment). Run with: npx tsx scripts/verify_live_testnet.mjs
//
// Uses the actual SuiGraphQLEventSource class, not a hand-rolled snippet, to prove the
// real EventSource implementation this service ships with genuinely round-trips against
// a live full node — by finding the real SignerRotated event our own testnet deployment
// produced.
import { SuiGraphQLEventSource } from "../src/eventSource.ts";

const PACKAGE_ID = "0x783ffc3f10c07ed01ba7799b92f2bbd663c1b2bbe3ac574dc03598e2f6a93e03";
const source = new SuiGraphQLEventSource(PACKAGE_ID, "https://graphql.testnet.sui.io/graphql", "testnet");

const page = await source.queryModuleEvents("oracle_registry", null, 10);
console.log(`Found ${page.events.length} oracle_registry event(s) via SuiGraphQLEventSource:`);
for (const e of page.events) {
  console.log(`  ${e.type} @ tx ${e.txDigest} checkpoint ${e.checkpoint}`);
  console.log(`    parsedJson: ${JSON.stringify(e.parsedJson)}`);
}

const rotated = page.events.find((e) => e.type.endsWith("::SignerRotated"));
if (!rotated) {
  console.error("FAIL: no SignerRotated event found.");
  process.exit(1);
}
const expectedPubkeyHex = "019ea63b80fef3076e32ad33f639cc2b7c67dd966902d00299540a2afc0f65ba";
const actualPubkeyHex = Buffer.from(rotated.parsedJson.pubkey, "base64").toString("hex");
if (actualPubkeyHex !== expectedPubkeyHex) {
  console.error(`FAIL: pubkey mismatch. expected ${expectedPubkeyHex}, got ${actualPubkeyHex}`);
  process.exit(1);
}
if (typeof rotated.checkpoint !== "number" || rotated.checkpoint <= 0) {
  console.error("FAIL: expected a real checkpoint number on the event");
  process.exit(1);
}

const coinType = await source.getObjectCoinType("0xf3d190c8ad619ded4d8bc47b8299e4577c17a9ce5b761475b56cb956d8d52f9b");
console.log(`getObjectCoinType on the OracleRegistry object (not generic, expect null): ${coinType}`);

console.log("PASS: real testnet SuiGraphQLEventSource round-trip confirmed end-to-end.");
