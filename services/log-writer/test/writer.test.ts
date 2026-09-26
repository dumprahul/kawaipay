import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { bytesToHex, MetricsRegistry } from "@kawaipay/shared";
import { parseLogFile } from "../src/logFile.js";
import { findPendingItems, writeLogForItem, writePendingLogs } from "../src/writer.js";
import { rebuildRecordsForItem } from "../src/rebuild.js";
import { registerLogWriterMetrics } from "../src/metrics.js";
import { createTestDatabase, seedCampaignAndLink, seedConfirmedBatchItem, seedTick } from "./testHarness.js";
import { FakeLogStore } from "./fakeLogStore.js";

const LOG_SECRET = "test-log-secret";
let pg: Pool;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_logwriter_writer_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links, sessions, ticks, batches, batch_items CASCADE");
});

afterAll(async () => {
  await pg.end();
});

async function seedOneConfirmedItem(linkId: string, seq: number) {
  await seedCampaignAndLink(pg, "0xca" + linkId.slice(4), linkId);
  const t0 = new Date("2026-01-01T00:00:00Z");
  const sessionId = linkId.slice(2, 10).padEnd(8, "0") + "-0000-0000-0000-000000000000";
  const tickId = await seedTick(pg, linkId, sessionId, 0, 100, t0);
  // Compute the real root the same way rebuild would, via a throwaway item first.
  const itemIdForRoot = await seedConfirmedBatchItem(pg, linkId, seq, 100, new Uint8Array(32), [tickId]);
  const { root } = await rebuildRecordsForItem(pg, itemIdForRoot, LOG_SECRET);
  await pg.query(`UPDATE batch_items SET log_root = $1 WHERE item_id = $2`, [Buffer.from(root), itemIdForRoot]);
  return { itemId: itemIdForRoot, root };
}

describe("writeLogForItem", () => {
  it("uploads the log and records log_blob_id when the recomputed root matches", async () => {
    const linkId = "0x" + "11".repeat(32);
    const { itemId, root } = await seedOneConfirmedItem(linkId, 1);
    const item = (await findPendingItems(pg))[0]!;
    expect(item.itemId).toBe(itemId);

    const store = new FakeLogStore();
    const outcome = await writeLogForItem(pg, store, item, LOG_SECRET);
    expect(outcome).toEqual({ kind: "written", itemId, blobId: `logs/${linkId}/1.jsonl` });

    const { rows } = await pg.query(`SELECT log_blob_id FROM batch_items WHERE item_id = $1`, [itemId]);
    expect(rows[0].log_blob_id).toBe(`logs/${linkId}/1.jsonl`);

    const uploaded = store.puts[0]!;
    const parsed = parseLogFile(uploaded.bytes);
    expect(parsed.header.root).toBe(bytesToHex(root));
    expect(parsed.header.leaf_count).toBe(1);
    expect(parsed.header.link_id).toBe(linkId);
  });

  it("refuses to upload and reports a mismatch when the stored log_root doesn't match the ticks", async () => {
    const linkId = "0x" + "22".repeat(32);
    await seedCampaignAndLink(pg, "0xca" + linkId.slice(4), linkId);
    const tickId = await seedTick(pg, linkId, "00000000-0000-0000-0000-000000000000", 0, 100, new Date());
    const itemId = await seedConfirmedBatchItem(pg, linkId, 1, 100, new Uint8Array(32).fill(0xff), [tickId]);
    const item = (await findPendingItems(pg))[0]!;

    const store = new FakeLogStore();
    const outcome = await writeLogForItem(pg, store, item, LOG_SECRET);
    expect(outcome.kind).toBe("root_mismatch");
    expect(store.puts).toHaveLength(0);

    const { rows } = await pg.query(`SELECT log_blob_id FROM batch_items WHERE item_id = $1`, [itemId]);
    expect(rows[0].log_blob_id).toBeNull();
  });

  it("retries a transient upload failure and still succeeds", async () => {
    const linkId = "0x" + "33".repeat(32);
    const { itemId } = await seedOneConfirmedItem(linkId, 1);
    const item = (await findPendingItems(pg))[0]!;

    const store = new FakeLogStore({ failFirstNPuts: 2 });
    const outcome = await writeLogForItem(pg, store, item, LOG_SECRET, { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 5 });
    expect(outcome.kind).toBe("written");
    const { rows } = await pg.query(`SELECT log_blob_id FROM batch_items WHERE item_id = $1`, [itemId]);
    expect(rows[0].log_blob_id).not.toBeNull();
  });

  it("reports upload_failed (and leaves log_blob_id null) once retries are exhausted", async () => {
    const linkId = "0x" + "44".repeat(32);
    await seedOneConfirmedItem(linkId, 1);
    const item = (await findPendingItems(pg))[0]!;

    const store = new FakeLogStore({ failFirstNPuts: 10 });
    const outcome = await writeLogForItem(pg, store, item, LOG_SECRET, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 });
    expect(outcome.kind).toBe("upload_failed");
    const { rows } = await pg.query(`SELECT log_blob_id FROM batch_items WHERE item_id = $1`, [item.itemId]);
    expect(rows[0].log_blob_id).toBeNull();
  });
});

describe("findPendingItems", () => {
  it("excludes items that already have a log_blob_id or aren't confirmed", async () => {
    const linkId = "0x" + "55".repeat(32);
    await seedCampaignAndLink(pg, "0xca" + linkId.slice(4), linkId);
    const t = new Date();
    const doneTickId = await seedTick(pg, linkId, "00000000-0000-0000-0000-000000000001", 0, 100, t);
    const doneItemId = await seedConfirmedBatchItem(pg, linkId, 1, 100, new Uint8Array(32), [doneTickId]);
    await pg.query(`UPDATE batch_items SET log_blob_id = 'already-done' WHERE item_id = $1`, [doneItemId]);

    const buildingTickId = await seedTick(pg, linkId, "00000000-0000-0000-0000-000000000002", 1, 100, t);
    const { rows: batchRows } = await pg.query(`INSERT INTO batches (status) VALUES ('building') RETURNING batch_id`);
    await pg.query(
      `INSERT INTO batch_items (batch_id, link_id, seq, amount, seconds_verified, log_root, expires_at_ms, signature, status)
       VALUES ($1, $2, 2, 100, 1, $3, $4, '\\x00', 'building')`,
      [Number(batchRows[0].batch_id), linkId, Buffer.from(new Uint8Array(32)), Date.now() + 60_000],
    );

    const pending = await findPendingItems(pg);
    expect(pending.map((p) => p.itemId)).not.toContain(doneItemId);
    expect(pending).toHaveLength(0);
    expect(buildingTickId).toBeGreaterThan(0);
  });
});

describe("writePendingLogs", () => {
  it("processes every pending item independently", async () => {
    const linkA = "0x" + "66".repeat(32);
    const linkB = "0x" + "77".repeat(32);
    await seedOneConfirmedItem(linkA, 1);
    await seedOneConfirmedItem(linkB, 1);

    const store = new FakeLogStore();
    const outcomes = await writePendingLogs(pg, store, LOG_SECRET);
    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((o) => o.kind === "written")).toBe(true);
    expect(await findPendingItems(pg)).toHaveLength(0);
  });

  it("records metrics when a registry is supplied", async () => {
    const linkId = "0x" + "88".repeat(32);
    await seedOneConfirmedItem(linkId, 1);

    const registry = new MetricsRegistry();
    const metrics = registerLogWriterMetrics(registry);
    await writePendingLogs(pg, new FakeLogStore(), LOG_SECRET, metrics);

    expect(registry.render()).toContain("logwriter_logs_written_total 1");
  });
});
