import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { LocalKeySigner } from "@kawaipay/oracle-core";
import { runCycle, type CycleConfig } from "../src/cycle.js";
import { createTestDatabase, seedCampaignAndLink, seedTick } from "./testHarness.js";
import { FakeChainClient } from "./fakeChainClient.js";

let pg: Pool;
const signer = new LocalKeySigner("432d7a9ffdc34a879a9f139787f5f9ae21bcd1570c86ed2210eb845972330c8");

function config(overrides: Partial<CycleConfig> = {}): CycleConfig {
  return {
    maxItemsPerBatch: 100,
    mirrorMaxLagMs: 30_000,
    relayerMinSui: 100_000_000,
    packageId: "0x" + "aa".repeat(32),
    registryId: "0x" + "bb".repeat(32),
    usdcType: "0x2::sui::SUI",
    logSecret: "test-log-secret",
    gasBudgetPerItem: 50_000_000,
    worldId: { freePayouts: 2, validityDays: 7 },
    ...overrides,
  };
}

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_batcher_cycle_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links, accruals, sessions, ticks, batches, batch_items, indexer_heartbeat CASCADE");
  // The batcher's INDEXER_LAG_TOO_HIGH guard reads this; seed it fresh so tests that
  // aren't specifically about that guard aren't skipped by an indexer that "never ran".
  await pg.query(`INSERT INTO indexer_heartbeat (name, last_polled_at) VALUES ('kawaipay-events:campaign', now())`);
});

afterAll(async () => {
  await pg.end();
});

describe("runCycle", () => {
  it("skips the cycle when the relayer balance guard fails, touching nothing", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "01".repeat(32) });
    await seedTick(pg, linkId, "11111111-1111-1111-1111-111111111111", 1, 500, new Date(Date.now() - 400_000));

    const chain = new FakeChainClient();
    chain.suiBalance = 1; // below relayerMinSui
    const outcome = await runCycle({ pg, chain, signer }, config());

    expect(outcome).toEqual({ kind: "skipped_guard", guard: "RELAYER_BALANCE_TOO_LOW", alerts: [] });
    const { rows } = await pg.query("SELECT count(*)::int FROM batches");
    expect(rows[0].count).toBe(0);
  });

  it("skips the cycle when a batch is already submitted", async () => {
    await pg.query(`INSERT INTO batches (status) VALUES ('submitted')`);
    const chain = new FakeChainClient();
    const outcome = await runCycle({ pg, chain, signer }, config());
    expect(outcome).toEqual({ kind: "skipped_guard", guard: "BATCH_ALREADY_SUBMITTED", alerts: [] });
  });

  it("is idle when there are no eligible links", async () => {
    const chain = new FakeChainClient();
    const outcome = await runCycle({ pg, chain, signer }, config());
    expect(outcome).toEqual({ kind: "idle", alerts: [] });
  });

  it("surfaces a rate_exceeded_sanity_check alert on the outcome instead of silently dropping it", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "09".repeat(32), maxRatePerSecond: 1 });
    await seedTick(pg, linkId, "99999999-9999-9999-9999-999999999999", 1, 999_999, new Date(Date.now() - 400_000));

    const chain = new FakeChainClient();
    const outcome = await runCycle({ pg, chain, signer }, config());

    expect(outcome.kind).toBe("idle"); // the only eligible link alerted out, so no batch was built
    expect(outcome.alerts).toEqual([{ linkId, reason: "rate_exceeded_sanity_check", detail: expect.anything() }]);
  });

  it("submits successfully when the whole batch simulates fine", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "02".repeat(32) });
    await seedTick(pg, linkId, "22222222-2222-2222-2222-222222222222", 1, 500, new Date(Date.now() - 400_000));

    const chain = new FakeChainClient();
    const outcome = await runCycle({ pg, chain, signer }, config());

    expect(outcome.kind).toBe("submitted");
    if (outcome.kind !== "submitted") throw new Error("expected submitted");
    expect(outcome.itemCount).toBe(1);
    expect(outcome.failedCount).toBe(0);
    expect(outcome.success).toBe(true);

    const { rows: batchRows } = await pg.query("SELECT status, tx_digest FROM batches WHERE batch_id = $1", [outcome.batchId]);
    expect(batchRows[0].status).toBe("confirmed");
    expect(batchRows[0].tx_digest).not.toBeNull();

    const { rows: itemRows } = await pg.query("SELECT status FROM batch_items WHERE batch_id = $1", [outcome.batchId]);
    expect(itemRows[0].status).toBe("confirmed");
  });

  it("drops a bad item via bisection, submits the rest, and releases the bad one's ticks", async () => {
    const { linkId: goodLink } = await seedCampaignAndLink(pg, { linkId: "0x" + "03".repeat(32) });
    const { linkId: badLink } = await seedCampaignAndLink(pg, { linkId: "0x" + "04".repeat(32) });
    await seedTick(pg, goodLink, "33333333-3333-3333-3333-333333333333", 1, 500, new Date(Date.now() - 400_000));
    await seedTick(pg, badLink, "44444444-4444-4444-4444-444444444444", 1, 500, new Date(Date.now() - 400_000));

    const chain = new FakeChainClient();
    chain.failingLinkIds.add(badLink);
    const outcome = await runCycle({ pg, chain, signer }, config());

    expect(outcome.kind).toBe("submitted");
    if (outcome.kind !== "submitted") throw new Error("expected submitted");
    expect(outcome.itemCount).toBe(1);
    expect(outcome.failedCount).toBe(1);

    const { rows: goodTick } = await pg.query("SELECT batch_item_id FROM ticks WHERE link_id = $1", [goodLink]);
    expect(goodTick[0].batch_item_id).not.toBeNull();

    const { rows: badTick } = await pg.query("SELECT batch_item_id FROM ticks WHERE link_id = $1", [badLink]);
    expect(badTick[0].batch_item_id).toBeNull(); // released, stays pending for a future cycle

    const { rows: badItem } = await pg.query("SELECT status FROM batch_items WHERE link_id = $1", [badLink]);
    expect(badItem[0].status).toBe("failed");
  });

  it("marks the whole batch failed and releases all ticks when every item fails dry-run", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "05".repeat(32) });
    await seedTick(pg, linkId, "55555555-5555-5555-5555-555555555555", 1, 500, new Date(Date.now() - 400_000));

    const chain = new FakeChainClient();
    chain.failingLinkIds.add(linkId);
    const outcome = await runCycle({ pg, chain, signer }, config());

    expect(outcome).toEqual({ kind: "all_failed_dry_run", batchId: expect.any(Number), failedCount: 1, alerts: [] });
    const { rows: tickRows } = await pg.query("SELECT batch_item_id FROM ticks WHERE link_id = $1", [linkId]);
    expect(tickRows[0].batch_item_id).toBeNull();
  });

  it("marks the batch and its items failed, releasing ticks, when the final submit fails on-chain", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "06".repeat(32) });
    await seedTick(pg, linkId, "66666666-6666-6666-6666-666666666666", 1, 500, new Date(Date.now() - 400_000));

    const chain = new FakeChainClient();
    chain.submitResult = { digest: "submit-fail-digest", success: false, abortCode: "5", error: "E_BAD_SEQ" };
    const outcome = await runCycle({ pg, chain, signer }, config());

    expect(outcome.kind).toBe("submitted");
    if (outcome.kind !== "submitted") throw new Error("expected submitted");
    expect(outcome.success).toBe(false);

    const { rows: batchRows } = await pg.query("SELECT status, error, tx_digest FROM batches WHERE batch_id = $1", [outcome.batchId]);
    expect(batchRows[0].status).toBe("failed");
    expect(batchRows[0].error).toBe("E_BAD_SEQ");
    expect(batchRows[0].tx_digest).toBe("submit-fail-digest"); // still recorded even on failure

    const { rows: tickRows } = await pg.query("SELECT batch_item_id FROM ticks WHERE link_id = $1", [linkId]);
    expect(tickRows[0].batch_item_id).toBeNull();
  });
});
