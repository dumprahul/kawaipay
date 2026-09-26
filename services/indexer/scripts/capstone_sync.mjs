// One-shot: process every existing testnet event for our capstone package into the
// local mirror, using the REAL indexer code (processPage), not a mock.
import { Pool } from "pg";
import { SuiGraphQLEventSource } from "../src/eventSource.ts";
import { processPage } from "../src/indexer.ts";

const PACKAGE_ID = "0x783ffc3f10c07ed01ba7799b92f2bbd663c1b2bbe3ac574dc03598e2f6a93e03";
const pg = new Pool({ connectionString: "postgres://localhost/kawaipay_capstone" });
const source = new SuiGraphQLEventSource(PACKAGE_ID, "https://graphql.testnet.sui.io/graphql", "testnet");

const log = (msg, meta) => console.log(JSON.stringify({ msg, ...meta }));

for (const module of ["oracle_registry", "campaign", "link", "payout"]) {
  let hasNext = true;
  while (hasNext) {
    const result = await processPage(pg, source, module, log);
    log("processed page", { module, ...result });
    hasNext = result.hasNextPage;
  }
}

await pg.end();
console.log("done");
