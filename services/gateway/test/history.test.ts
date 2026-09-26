import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { getLinkHistory } from "../src/history.js";
import { createTestDatabase, seedCampaignAndLink } from "./testHarness.js";

let pg: Pool;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_gw_history_test");
}, 30_000);

afterAll(async () => {
  await pg.end();
});

async function seedSettlement(
  linkId: string,
  seq: number,
  opts: { logBlobId?: string | null; txDigest?: string } = {},
) {
  const logRoot = Buffer.alloc(32, seq + 1);
  await pg.query(
    `INSERT INTO settlements (tx_digest, event_seq, link_id, seq, amount, seconds_verified, log_root, checkpoint, ts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [opts.txDigest ?? `digest-${linkId}-${seq}`, seq, linkId, seq, (seq + 1) * 100, (seq + 1) * 5, logRoot, 1000 + seq],
  );
  const { rows: batchRows } = await pg.query(`INSERT INTO batches (status) VALUES ('confirmed') RETURNING batch_id`);
  await pg.query(
    `INSERT INTO batch_items (batch_id, link_id, seq, amount, seconds_verified, log_root, expires_at_ms, signature, log_blob_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '\\x00', $8, 'confirmed')`,
    [Number(batchRows[0].batch_id), linkId, seq, (seq + 1) * 100, (seq + 1) * 5, logRoot, Date.now() + 60_000, opts.logBlobId ?? null],
  );
}

describe("getLinkHistory", () => {
  it("returns null for a link that doesn't exist", async () => {
    const result = await getLinkHistory(pg, "0x" + "00".repeat(32));
    expect(result).toBeNull();
  });

  it("returns an empty page for an existing link with no settlements yet", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "01".repeat(32) });
    const result = await getLinkHistory(pg, linkId);
    expect(result).toEqual({ linkId, settlements: [], nextBeforeSeq: null });
  });

  it("returns settlements newest-seq-first, with the log_blob_id from the matching confirmed batch item", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "02".repeat(32) });
    await seedSettlement(linkId, 0, { logBlobId: `logs/${linkId}/0.jsonl` });
    await seedSettlement(linkId, 1, { logBlobId: null }); // log-writer hasn't uploaded this one yet

    const result = await getLinkHistory(pg, linkId);
    expect(result?.settlements.map((s) => s.seq)).toEqual([1, 0]);
    expect(result?.settlements[0]).toMatchObject({ seq: 1, amount: 200, secondsVerified: 10, logBlobId: null });
    expect(result?.settlements[1]).toMatchObject({ seq: 0, amount: 100, secondsVerified: 5, logBlobId: `logs/${linkId}/0.jsonl` });
    expect(result?.settlements[0]?.logRoot).toBe(Buffer.alloc(32, 2).toString("hex"));
    expect(result?.nextBeforeSeq).toBeNull();
  });

  it("paginates with limit + beforeSeq", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "03".repeat(32) });
    for (let seq = 0; seq < 5; seq++) {
      await seedSettlement(linkId, seq);
    }

    const firstPage = await getLinkHistory(pg, linkId, { limit: 2 });
    expect(firstPage?.settlements.map((s) => s.seq)).toEqual([4, 3]);
    expect(firstPage?.nextBeforeSeq).toBe(3);

    const secondPage = await getLinkHistory(pg, linkId, { limit: 2, beforeSeq: firstPage!.nextBeforeSeq! });
    expect(secondPage?.settlements.map((s) => s.seq)).toEqual([2, 1]);
    expect(secondPage?.nextBeforeSeq).toBe(1);

    const lastPage = await getLinkHistory(pg, linkId, { limit: 2, beforeSeq: secondPage!.nextBeforeSeq! });
    expect(lastPage?.settlements.map((s) => s.seq)).toEqual([0]);
    expect(lastPage?.nextBeforeSeq).toBeNull();
  });

  it("caps limit at 100 and floors it at 1", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "04".repeat(32) });
    await seedSettlement(linkId, 0);
    const zeroClamped = await getLinkHistory(pg, linkId, { limit: 0 });
    expect(zeroClamped?.settlements).toHaveLength(1);
  });
});
