// Formal end-to-end acceptance script (ticket J2). Proves the real settlement pipeline
// still works, chained together the way it actually runs in production: real oracle-core
// scoring -> real batcher (build, sign, submit a settle PTB) -> real indexer (sync the
// resulting PayoutSettled event) -> real log-writer (write + verify the tick log) -> real
// audit CLI logic (recompute the Merkle root from the log and check it against the
// on-chain event). Every step below calls the actual exported function each service uses
// in production; nothing here is mocked. The only thing this script doesn't exercise is
// the gateway's HTTP layer itself (session/start, heartbeat validation, MAC checking) —
// that has its own, separately thorough test suite; this script's unique value is proving
// the pipeline *between* services, which nothing else does end to end.
//
// Requires a pre-funded campaign + link on real testnet (see the header comment further
// down for how those were provisioned) and real oracle-signer/relayer keys. Run with:
//   pnpm --filter @kawaipay/batcher exec tsx ../../scripts/e2e_acceptance.mjs
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
import { Client, Pool } from "pg";
import { LocalKeySigner, scoreTick } from "../packages/oracle-core/src/index.ts";
import { DEFAULT_CAP_LIMITS, TICK_SECONDS } from "../packages/shared/src/index.ts";

import { SuiGraphQLChainClient } from "../services/batcher/src/chainClient.ts";
import { runCycle } from "../services/batcher/src/cycle.ts";

import { SuiGraphQLEventSource } from "../services/indexer/src/eventSource.ts";
import { processPage } from "../services/indexer/src/indexer.ts";

import { LocalFsStore } from "../services/log-writer/src/logStore.ts";
import { writePendingLogs } from "../services/log-writer/src/writer.ts";
import { auditSettlement } from "../services/log-writer/src/audit.ts";

const CONFIG = {
  packageId: process.env.PACKAGE_ID ?? "0x783ffc3f10c07ed01ba7799b92f2bbd663c1b2bbe3ac574dc03598e2f6a93e03",
  registryId: process.env.REGISTRY_ID ?? "0xf3d190c8ad619ded4d8bc47b8299e4577c17a9ce5b761475b56cb956d8d52f9b",
  usdcType: process.env.USDC_TYPE ?? "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
  graphqlUrl: process.env.SUI_GRAPHQL_URL ?? "https://graphql.testnet.sui.io/graphql",
  network: process.env.SUI_NETWORK ?? "testnet",
  campaignId: required("CAMPAIGN_ID"),
  linkId: required("LINK_ID"),
  oracleSignerKeyHex: readFileSync(process.env.ORACLE_SIGNER_KEY_FILE ?? join(REPO_ROOT, "contracts/deployment/testnet-oracle-signer.key.json"), "utf8"),
  relayerKeyHex: readFileSync(process.env.RELAYER_KEY_FILE ?? join(REPO_ROOT, "contracts/deployment/testnet-relayer.key.json"), "utf8"),
};

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const oracleSignerSeed = JSON.parse(CONFIG.oracleSignerKeyHex).privateSeedHex;
const relayerSeed = JSON.parse(CONFIG.relayerKeyHex).seedHex;

const log = (msg, meta) => console.log(JSON.stringify({ msg, ...meta }));
const assert = (cond, msg) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  log("assertion passed", { msg });
};

const BASE_STATS = {
  windowMs: 5000,
  visibleMs: 5000,
  focusedMs: 5000,
  inViewportMs: 5000,
  cvrPct: 100,
  scrollEvents: 5,
  scrollDepthPct: 40,
  scrollSpeedMax: 500,
  pointerMoves: 10,
  pointerCells: 6,
  touchEvents: 0,
  keyEvents: 0,
  tabSwitches: 0,
};

async function createScratchDatabase(dbName) {
  const adminUrl = process.env.POSTGRES_ADMIN_URL ?? "postgres://localhost/postgres";
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  const pg = new Pool({ connectionString: url.toString() });
  await pg.query(readFileSync(join(REPO_ROOT, "db/migrations/0001_init.sql"), "utf8"));
  return pg;
}

/** Real oracle-core scoring, real ticks table writes — the same shape scoring.ts persists, just without gateway's HTTP/session plumbing around it. */
async function scoreAndInsertTick(pg, { linkId, sessionId, seq, receivedAt, ratePerSecond, history }) {
  const input = {
    stats: BASE_STATS,
    serverGapMs: 5000,
    history,
    ipClass: "residential",
    sessionSecondsPaid: history.length * TICK_SECONDS,
    linkRisk: { weightMultiplier: 1, hold: false },
    ratePerSecond,
    linkFirstTickMs: receivedAt.getTime() - 30 * 24 * 3600_000, // well past the 24h warm-up window
    nowMs: receivedAt.getTime(),
  };
  const result = scoreTick(input, { linkHourlyEarned: 0, sourceHourlyEarned: 0 }, DEFAULT_CAP_LIMITS);
  await pg.query(
    `INSERT INTO sessions (session_id, link_id, started_at, last_seen_at, ip_hash, ip_class)
     VALUES ($1, $2, $3, $3, '\\x00', 'residential')
     ON CONFLICT (session_id) DO NOTHING`,
    [sessionId, linkId, receivedAt],
  );
  await pg.query(
    `INSERT INTO ticks (session_id, link_id, seq, received_at, server_gap_ms, features, score, verdict, weight, amount, reasons, scorer_version)
     VALUES ($1, $2, $3, $4, 5000, $5, $6, $7, $8, $9, $10, $11)`,
    [sessionId, linkId, seq, receivedAt, JSON.stringify(BASE_STATS), result.score, result.verdict, result.weightBp / 10000, result.amount, result.reasons, result.scorerVersion],
  );
  await pg.query(
    `INSERT INTO accruals (link_id, earned_total, settled_total) VALUES ($1, $2, 0)
     ON CONFLICT (link_id) DO UPDATE SET earned_total = accruals.earned_total + EXCLUDED.earned_total`,
    [linkId, result.amount],
  );
  history.push({ stats: BASE_STATS, gapMs: 5000, score: result.score });
  return result;
}

async function main() {
  log("== J2 e2e acceptance run starting ==", { campaignId: CONFIG.campaignId, linkId: CONFIG.linkId });

  const scratchDir = await mkdtemp(join(tmpdir(), "kawaipay-e2e-logs-"));
  const pg = await createScratchDatabase("kawaipay_e2e_acceptance");
  const eventSource = new SuiGraphQLEventSource(CONFIG.packageId, CONFIG.graphqlUrl, CONFIG.network);
  const chain = new SuiGraphQLChainClient(CONFIG.graphqlUrl, CONFIG.network, relayerSeed);
  const signer = new LocalKeySigner(oracleSignerSeed);
  const logSecret = "e2e-acceptance-log-secret";

  try {
    // Step 1: sync the campaign + link's current on-chain state (real indexer code).
    log("step 1: syncing campaign + link state from chain");
    // Includes "payout" too: this link may have been settled by an earlier run of this
    // same script (real testnet state persists across runs), and next_seq only ever
    // advances via PayoutSettled — never touched by LinkCreated.
    for (const module of ["oracle_registry", "campaign", "link", "payout"]) {
      let hasNext = true;
      while (hasNext) {
        const result = await processPage(pg, eventSource, module, log);
        hasNext = result.hasNextPage;
      }
    }
    const { rows: linkRows } = await pg.query(`SELECT budget_remaining, next_seq FROM links WHERE link_id = $1`, [CONFIG.linkId]);
    assert(linkRows.length === 1, "link synced into local mirror");
    const budgetBefore = Number(linkRows[0].budget_remaining);
    log("link synced", { budgetRemaining: budgetBefore, nextSeq: linkRows[0].next_seq });

    // Step 2: real oracle-core scoring for a handful of ticks (bypassing only the
    // gateway's HTTP/session layer, which has its own dedicated test suite).
    log("step 2: scoring ticks with the real oracle-core pipeline");
    const history = [];
    const t0 = Date.now() - 60_000;
    let totalAmount = 0;
    for (let i = 0; i < 6; i++) {
      const result = await scoreAndInsertTick(pg, {
        linkId: CONFIG.linkId,
        sessionId: `e2e00000-0000-0000-0000-00000000000${i}`,
        seq: i,
        receivedAt: new Date(t0 + i * 5000),
        ratePerSecond: 100,
        history,
      });
      totalAmount += result.amount;
      log("tick scored", { i, verdict: result.verdict, amount: result.amount });
    }
    assert(totalAmount > 0, "at least some amount was earned across the scored ticks");

    // Step 3: real batcher cycle — builds, signs and submits a real settle transaction.
    log("step 3: running the real batcher cycle against testnet");
    await pg.query(`INSERT INTO indexer_heartbeat (name, last_polled_at) VALUES ('kawaipay-events:campaign', now())`);
    const outcome = await runCycle(
      { pg, chain, signer },
      {
        maxItemsPerBatch: 10,
        mirrorMaxLagMs: 60_000,
        relayerMinSui: 10_000_000,
        packageId: CONFIG.packageId,
        registryId: CONFIG.registryId,
        usdcType: CONFIG.usdcType,
        logSecret,
        gasBudgetPerItem: 50_000_000,
      },
    );
    log("batcher cycle outcome", { outcome });
    assert(outcome.kind === "submitted" && outcome.success, `batcher cycle actually submitted and confirmed (got kind=${outcome.kind})`);
    const txDigest = outcome.digest;

    // Step 4: real indexer sync again — picks up the PayoutSettled event just produced.
    // The GraphQL read layer can lag a few seconds behind a transaction's own
    // confirmation, so this retries the drain-to-caught-up sync rather than assuming
    // one pass is enough.
    log("step 4: syncing the PayoutSettled event back via the real indexer");
    let settlementRows = [];
    for (let attempt = 1; attempt <= 10; attempt++) {
      let hasNext = true;
      while (hasNext) {
        const result = await processPage(pg, eventSource, "payout", log);
        hasNext = result.hasNextPage;
      }
      ({ rows: settlementRows } = await pg.query(`SELECT seq, amount FROM settlements WHERE link_id = $1 AND tx_digest = $2`, [
        CONFIG.linkId,
        txDigest,
      ]));
      if (settlementRows.length === 1) break;
      log("this run's settlement not indexed yet, retrying", { attempt });
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    assert(settlementRows.length === 1, `this run's own settlement (tx ${txDigest}) was indexed`);
    assert(
      Number(settlementRows[0].amount) === totalAmount,
      `the indexed settlement's amount (${settlementRows[0].amount}) matches what this run actually scored (${totalAmount})`,
    );

    // NOTE: earned_total vs settled_total is checked per-run's own delta, not as a raw
    // equality of the (fresh, throwaway) local accruals row — this link persists on real
    // testnet across repeated runs of this script, so settled_total legitimately
    // accumulates every prior run's settlements too, while the local accruals row only
    // ever reflects ticks scored in this one run.
    const { rows: accrualRows } = await pg.query(`SELECT earned_total, settled_total FROM accruals WHERE link_id = $1`, [CONFIG.linkId]);
    assert(accrualRows.length === 1, "accruals row exists");
    assert(Number(accrualRows[0].earned_total) === totalAmount, `local earned_total (${accrualRows[0].earned_total}) matches this run's scored amount (${totalAmount})`);
    assert(
      Number(accrualRows[0].settled_total) >= totalAmount,
      `settled_total (${accrualRows[0].settled_total}) includes at least this run's settled amount (${totalAmount})`,
    );

    // Step 5: real log-writer — rebuilds the tick log from Postgres and uploads it.
    log("step 5: writing the settlement's tick log");
    const logStore = new LocalFsStore(scratchDir);
    const writeOutcomes = await writePendingLogs(pg, logStore, logSecret);
    assert(writeOutcomes.length === 1 && writeOutcomes[0].kind === "written", `log-writer wrote exactly one log (got ${JSON.stringify(writeOutcomes)})`);
    const blobId = writeOutcomes[0].blobId;

    // Step 6: real audit logic — recomputes the root from the log and checks it against
    // the real on-chain PayoutSettled event, independent of anything in our own database.
    log("step 6: auditing the settlement against the chain");
    const seq = Number(settlementRows[0].seq);

    const auditResult = await auditSettlement({
      graphqlUrl: CONFIG.graphqlUrl,
      network: CONFIG.network,
      txDigest,
      linkId: CONFIG.linkId,
      seq,
      blobId,
      logStore,
    });
    log("audit result", { ...auditResult, onChainRoot: auditResult.onChainRoot, recomputedRoot: auditResult.recomputedRoot });
    assert(auditResult.ok, "audit recomputed root matches the real on-chain PayoutSettled event's log_root");
    assert(auditResult.headerMatchesOnChain, "log file's own header root matches the on-chain root too");

    console.log("\n=== J2 ACCEPTANCE: PASS ===");
    console.log(`tx: https://testnet.suivision.xyz/txblock/${txDigest}`);
    process.exitCode = 0;
  } catch (err) {
    console.error("\n=== J2 ACCEPTANCE: FAIL ===");
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  } finally {
    await pg.end();
    await rm(scratchDir, { recursive: true, force: true });
  }
}

main();
