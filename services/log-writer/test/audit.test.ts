import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeLogRoot } from "@kawaipay/shared";
import { auditSettlement } from "../src/audit.js";
import { buildLogFile, headerFor } from "../src/logFile.js";
import { LocalFsStore } from "../src/logStore.js";
import type { OnChainSettlement } from "../src/chainEvent.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kawaipay-audit-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const RECORDS = ['{"n":0}', '{"n":1}', '{"n":2}'];
const LINK_ID = "0x" + "aa".repeat(32);
const CAMPAIGN_ID = "0xca" + "aa".repeat(31);

function fakeFetchEvent(event: OnChainSettlement | null) {
  return async () => event;
}

describe("auditSettlement", () => {
  it("passes when the log's recomputed root matches the on-chain event", async () => {
    const root = computeLogRoot(RECORDS);
    const store = new LocalFsStore(dir);
    const header = headerFor(LINK_ID, CAMPAIGN_ID, 3, root, "1.0.0");
    const { blobId } = await store.put("logs/x/3.jsonl", buildLogFile(header, RECORDS));

    const result = await auditSettlement({
      graphqlUrl: "unused",
      network: "testnet",
      txDigest: "fakeDigest",
      linkId: LINK_ID,
      seq: 3,
      blobId,
      logStore: store,
      fetchEvent: fakeFetchEvent({ linkId: LINK_ID, campaignId: CAMPAIGN_ID, seq: 3, amount: 100, secondsVerified: 15, logRoot: root }),
    });

    expect(result.ok).toBe(true);
    expect(result.headerMatchesOnChain).toBe(true);
    expect(result.leafCount).toBe(3);
  });

  it("fails when a record was tampered with after the fact (recomputed root no longer matches)", async () => {
    const root = computeLogRoot(RECORDS);
    const store = new LocalFsStore(dir);
    const header = headerFor(LINK_ID, CAMPAIGN_ID, 3, root, "1.0.0");
    const bytes = buildLogFile(header, RECORDS);
    // Tamper: flip a byte in one of the record lines, leaving the header's claimed root untouched.
    const tampered = Buffer.from(bytes);
    const idx = tampered.indexOf('"n":1');
    tampered[idx + 4] = "9".charCodeAt(0);
    const { blobId } = await store.put("logs/x/3-tampered.jsonl", tampered);

    const result = await auditSettlement({
      graphqlUrl: "unused",
      network: "testnet",
      txDigest: "fakeDigest",
      linkId: LINK_ID,
      seq: 3,
      blobId,
      logStore: store,
      fetchEvent: fakeFetchEvent({ linkId: LINK_ID, campaignId: CAMPAIGN_ID, seq: 3, amount: 100, secondsVerified: 15, logRoot: root }),
    });

    expect(result.ok).toBe(false);
    // The header itself still (falsely) claims the original root — a real audit would
    // also flag that the header and the recomputation disagree.
    expect(result.headerMatchesOnChain).toBe(true);
  });

  it("throws when no matching PayoutSettled event is found on chain", async () => {
    const store = new LocalFsStore(dir);
    await expect(
      auditSettlement({
        graphqlUrl: "unused",
        network: "testnet",
        txDigest: "fakeDigest",
        linkId: LINK_ID,
        seq: 3,
        blobId: "logs/x/3.jsonl",
        logStore: store,
        fetchEvent: fakeFetchEvent(null),
      }),
    ).rejects.toThrow(/no PayoutSettled event/);
  });
});
