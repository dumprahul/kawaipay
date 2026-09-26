// One-shot: run the REAL batcher cycle against real testnet, using the real oracle
// signer key and a dedicated relayer key. Not a mock, not a dry-run harness — this is
// the actual production runCycle() function from src/cycle.ts.
import { Pool } from "pg";
import { LocalKeySigner } from "@kawaipay/oracle-core";
import { SuiGraphQLChainClient } from "../src/chainClient.ts";
import { runCycle } from "../src/cycle.ts";

const pg = new Pool({ connectionString: "postgres://localhost/kawaipay_capstone" });
const chain = new SuiGraphQLChainClient(
  "https://graphql.testnet.sui.io/graphql",
  "testnet",
  "d4045a13ec86346c90eda3389d2d4f5451c7a3e51976825a82c19e590740a0cd", // relayer seed
);
const signer = new LocalKeySigner("3a25a1397c15ea3fa296388216005610391ecdc9e22ee4f979aeb1496102b0a9"); // oracle signer seed

console.log("Relayer address:", chain.relayerAddress);
console.log("Relayer SUI balance:", await chain.getSuiBalance(chain.relayerAddress));

const outcome = await runCycle(
  { pg, chain, signer },
  {
    maxItemsPerBatch: 100,
    mirrorMaxLagMs: 30_000,
    relayerMinSui: 10_000_000, // 0.01 SUI floor for this test
    packageId: "0x783ffc3f10c07ed01ba7799b92f2bbd663c1b2bbe3ac574dc03598e2f6a93e03",
    registryId: "0xf3d190c8ad619ded4d8bc47b8299e4577c17a9ce5b761475b56cb956d8d52f9b",
    usdcType: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
    logSecret: "capstone-log-secret",
    gasBudgetPerItem: 50_000_000,
  },
);

console.log("Cycle outcome:", JSON.stringify(outcome, null, 2));
await pg.end();
