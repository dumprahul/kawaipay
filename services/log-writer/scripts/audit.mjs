#!/usr/bin/env node
// Public audit CLI (spec section 11, ticket G2). Verifies a settled batch item without
// needing our database: given a link and the seq it settled at, it reads the real
// PayoutSettled event straight off the chain, fetches the log-writer's stored log for
// that item, and independently recomputes the Merkle root to confirm it matches what was
// actually paid out on-chain.
//
// The transaction digest and log blob ID are looked up from the gateway's public
// GET /v1/links/{linkId}/history endpoint (ticket E3) — the one piece of "trusted lookup"
// this needs, since neither is discoverable from the chain alone. Pass --digest/--blob-id
// directly to skip that lookup (e.g. auditing offline against a value from a block explorer).
//
// Usage (run with tsx, not plain node, since it imports .ts sources directly):
//   pnpm exec tsx scripts/audit.mjs --link-id <0x..> --seq <n> \
//     [--gateway-url http://localhost:8080] [--digest <tx digest>] [--blob-id <path>] \
//     [--log-store-dir ./data/logs] [--graphql-url https://graphql.testnet.sui.io/graphql] [--network testnet]
import { LocalFsStore } from "../src/logStore.ts";
import { auditSettlement } from "../src/audit.ts";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  return args;
}

/** Resolves the tx digest + log blob ID for one (link, seq) via the public history endpoint. */
async function resolveSettlementRef(gatewayUrl, linkId, seq) {
  const url = `${gatewayUrl}/v1/links/${linkId}/history?limit=1&beforeSeq=${seq + 1}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`gateway history lookup failed: HTTP ${res.status} (${url})`);
  }
  const page = await res.json();
  const entry = page.settlements?.find((s) => s.seq === seq);
  if (!entry) {
    throw new Error(`no settlement at seq ${seq} for link ${linkId} (per ${url})`);
  }
  if (!entry.logBlobId) {
    throw new Error(`settlement at seq ${seq} has no log_blob_id yet — the log-writer hasn't uploaded it`);
  }
  return { txDigest: entry.txDigest, blobId: entry.logBlobId };
}

const args = parseArgs(process.argv.slice(2));
for (const required of ["link-id", "seq"]) {
  if (!args[required]) {
    console.error(`Missing required --${required}`);
    console.error("Usage: pnpm exec tsx scripts/audit.mjs --link-id <0x..> --seq <n> [--gateway-url http://localhost:8080] [--digest <tx>] [--blob-id <path>]");
    process.exit(2);
  }
}

const logStore = new LocalFsStore(args["log-store-dir"] ?? "./data/logs");
const linkId = args["link-id"];
const seq = Number(args["seq"]);

try {
  let txDigest = args["digest"];
  let blobId = args["blob-id"];
  if (!txDigest || !blobId) {
    const resolved = await resolveSettlementRef(args["gateway-url"] ?? "http://localhost:8080", linkId, seq);
    txDigest ??= resolved.txDigest;
    blobId ??= resolved.blobId;
  }

  const result = await auditSettlement({
    graphqlUrl: args["graphql-url"] ?? "https://graphql.testnet.sui.io/graphql",
    network: args["network"] ?? "testnet",
    txDigest,
    linkId,
    seq,
    blobId,
    logStore,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.ok) {
    console.log(`\nPASS — recomputed root matches the on-chain PayoutSettled event (${result.leafCount} records).`);
    process.exit(0);
  } else {
    console.log(`\nFAIL — recomputed root does NOT match the on-chain event.`);
    process.exit(1);
  }
} catch (err) {
  console.error("Audit error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}
