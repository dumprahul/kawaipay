import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { LocalKeySigner } from "@kawaipay/oracle-core";
import { reserveBatch, selectEligibleLinks } from "../src/selection.js";
import { createTestDatabase, seedCampaignAndLink, seedTick } from "./testHarness.js";

let pg: Pool;
const signer = new LocalKeySigner("432d7a9ffdc34a879a9f139787f5f9ae21bcd1570c86ed2210eb845972330c8");
const LOG_SECRET = "test-log-secret";

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_batcher_selection_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links, accruals, sessions, ticks, batches, batch_items CASCADE");
});

afterAll(async () => {
  await pg.end();
});

describe("selectEligibleLinks", () => {
  it("selects links with unbatched, earning ticks, oldest pending first", async () => {
    const { linkId: linkA } = await seedCampaignAndLink(pg, { linkId: "0x" + "01".repeat(32) });
    const { linkId: linkB } = await seedCampaignAndLink(pg, { linkId: "0x" + "02".repeat(32) });
    await seedTick(pg, linkB, "11111111-1111-1111-1111-111111111111", 1, 100, new Date("2026-01-01T00:00:10Z"));
    await seedTick(pg, linkA, "22222222-2222-2222-2222-222222222222", 1, 100, new Date("2026-01-01T00:00:00Z"));

    const links = await selectEligibleLinks(pg, 10);
    expect(links.map((l) => l.linkId)).toEqual([linkA, linkB]); // A's tick is older
  });

  it("excludes frozen links", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "03".repeat(32), frozen: true });
    await seedTick(pg, linkId, "33333333-3333-3333-3333-333333333333", 1, 100, new Date());
    expect(await selectEligibleLinks(pg, 10)).toEqual([]);
  });

  it("excludes links with a batch item already building or submitted", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "04".repeat(32) });
    await seedTick(pg, linkId, "44444444-4444-4444-4444-444444444444", 1, 100, new Date());
    const { rows } = await pg.query(`INSERT INTO batches (status) VALUES ('building') RETURNING batch_id`);
    await pg.query(
      `INSERT INTO batch_items (batch_id, link_id, seq, amount, seconds_verified, log_root, expires_at_ms, signature, status)
       VALUES ($1, $2, 0, 100, 60, '\\x00', 0, '\\x00', 'building')`,
      [rows[0].batch_id, linkId],
    );
    expect(await selectEligibleLinks(pg, 10)).toEqual([]);
  });

  it("excludes ticks with amount 0", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "05".repeat(32) });
    await seedTick(pg, linkId, "55555555-5555-5555-5555-555555555555", 1, 0, new Date());
    expect(await selectEligibleLinks(pg, 10)).toEqual([]);
  });

  it("respects the limit", async () => {
    for (let i = 1; i <= 3; i++) {
      const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + `1${i}`.repeat(16).slice(0, 64) });
      await seedTick(pg, linkId, `1${i}111111-1111-1111-1111-111111111111`, 1, 100, new Date());
    }
    const links = await selectEligibleLinks(pg, 2);
    expect(links).toHaveLength(2);
  });
});

describe("reserveBatch", () => {
  it("builds and signs an attestation, assigns ticks, and creates a batch_items row", async () => {
    const { linkId, campaignId } = await seedCampaignAndLink(pg, { linkId: "0x" + "06".repeat(32) });
    await seedTick(pg, linkId, "66666666-6666-6666-6666-666666666666", 1, 500, new Date(Date.now() - 400_000)); // old enough to bypass MIN_SETTLE_UNITS

    const links = await selectEligibleLinks(pg, 10);
    const result = await reserveBatch(pg, signer, links, LOG_SECRET, Date.now());

    expect(result.batchId).not.toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.linkId).toBe(linkId);
    expect(result.items[0]!.campaignId).toBe(campaignId);
    expect(result.items[0]!.amount).toBe(500);
    expect(result.items[0]!.signature.length).toBe(64);
    expect(result.items[0]!.logRoot.length).toBe(32);

    const { rows: tickRows } = await pg.query("SELECT batch_item_id FROM ticks WHERE link_id = $1", [linkId]);
    expect(Number(tickRows[0].batch_item_id)).toBe(result.items[0]!.itemId);

    const { rows: batchRows } = await pg.query("SELECT status FROM batches WHERE batch_id = $1", [result.batchId]);
    expect(batchRows[0].status).toBe("building");
  });

  it("rolls back and returns no batch when every candidate link is skipped (below min settle, too fresh)", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "07".repeat(32) });
    await seedTick(pg, linkId, "77777777-7777-7777-7777-777777777777", 1, 5, new Date()); // tiny amount, brand new

    const links = await selectEligibleLinks(pg, 10);
    const result = await reserveBatch(pg, signer, links, LOG_SECRET, Date.now());

    expect(result.batchId).toBeNull();
    expect(result.items).toEqual([]);
    const { rows } = await pg.query("SELECT count(*)::int FROM batches");
    expect(rows[0].count).toBe(0); // no empty batch left behind

    const { rows: tickRows } = await pg.query("SELECT batch_item_id FROM ticks WHERE link_id = $1", [linkId]);
    expect(tickRows[0].batch_item_id).toBeNull(); // tick still pending
  });

  it("alerts and skips a link whose amount would exceed the on-chain rate ceiling", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "08".repeat(32), maxRatePerSecond: 1 });
    await seedTick(pg, linkId, "88888888-8888-8888-8888-888888888888", 1, 999_999, new Date(Date.now() - 400_000));

    const links = await selectEligibleLinks(pg, 10);
    const result = await reserveBatch(pg, signer, links, LOG_SECRET, Date.now());

    expect(result.batchId).toBeNull();
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]!.linkId).toBe(linkId);
    expect(result.alerts[0]!.reason).toBe("rate_exceeded_sanity_check");
  });

  it("builds one attestation per link when multiple links are eligible in the same cycle", async () => {
    const { linkId: linkA } = await seedCampaignAndLink(pg, { linkId: "0x" + "09".repeat(32) });
    const { linkId: linkB } = await seedCampaignAndLink(pg, { linkId: "0x" + "0a".repeat(32) });
    await seedTick(pg, linkA, "99999999-9999-9999-9999-999999999999", 1, 500, new Date(Date.now() - 400_000));
    await seedTick(pg, linkB, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", 1, 500, new Date(Date.now() - 400_000));

    const links = await selectEligibleLinks(pg, 10);
    const result = await reserveBatch(pg, signer, links, LOG_SECRET, Date.now());

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.linkId).sort()).toEqual([linkA, linkB].sort());
  });
});
