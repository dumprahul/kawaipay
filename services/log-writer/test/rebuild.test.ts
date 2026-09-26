import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { buildTickLogRecord, canonicalTickRecordJson, computeLogRoot } from "@kawaipay/shared";
import { rebuildRecordsForItem } from "../src/rebuild.js";
import { createTestDatabase, seedCampaignAndLink, seedConfirmedBatchItem, seedTick } from "./testHarness.js";

const LOG_SECRET = "test-log-secret";
let pg: Pool;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_logwriter_rebuild_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links, sessions, ticks, batches, batch_items CASCADE");
});

afterAll(async () => {
  await pg.end();
});

describe("rebuildRecordsForItem", () => {
  it("rebuilds the exact records + root the batcher would have computed, in received_at order", async () => {
    const linkId = "0x" + "aa".repeat(32);
    await seedCampaignAndLink(pg, "0xca" + linkId.slice(4), linkId);

    const t0 = new Date("2026-01-01T00:00:00Z");
    const t1 = new Date("2026-01-01T00:00:05Z");
    const t2 = new Date("2026-01-01T00:00:10Z");
    // Seed out of order to prove the rebuild sorts by received_at, not insertion order.
    const id2 = await seedTick(pg, linkId, "22222222-2222-2222-2222-222222222222", 2, 100, t2);
    const id0 = await seedTick(pg, linkId, "00000000-0000-0000-0000-000000000000", 0, 100, t0);
    const id1 = await seedTick(pg, linkId, "11111111-1111-1111-1111-111111111111", 1, 100, t1);

    // Independently compute what the batcher would have hashed, in the correct order.
    const expectedRecords = [
      buildTickLogRecord(
        { sessionId: "00000000-0000-0000-0000-000000000000", receivedAt: t0, seq: 0, serverGapMs: 5000, ipClass: "residential", features: { windowMs: 5000, visibleMs: 5000, focusedMs: 5000, inViewportMs: 5000, cvrPct: 100, scrollEvents: 5, scrollDepthPct: 40, scrollSpeedMax: 500, pointerMoves: 10, pointerCells: 6, touchEvents: 0, keyEvents: 0, tabSwitches: 0 }, score: 0.9, verdict: "pay", weight: 1, amount: 100, reasons: [], scorerVersion: "1.0.0" },
        LOG_SECRET,
      ),
      buildTickLogRecord(
        { sessionId: "11111111-1111-1111-1111-111111111111", receivedAt: t1, seq: 1, serverGapMs: 5000, ipClass: "residential", features: { windowMs: 5000, visibleMs: 5000, focusedMs: 5000, inViewportMs: 5000, cvrPct: 100, scrollEvents: 5, scrollDepthPct: 40, scrollSpeedMax: 500, pointerMoves: 10, pointerCells: 6, touchEvents: 0, keyEvents: 0, tabSwitches: 0 }, score: 0.9, verdict: "pay", weight: 1, amount: 100, reasons: [], scorerVersion: "1.0.0" },
        LOG_SECRET,
      ),
      buildTickLogRecord(
        { sessionId: "22222222-2222-2222-2222-222222222222", receivedAt: t2, seq: 2, serverGapMs: 5000, ipClass: "residential", features: { windowMs: 5000, visibleMs: 5000, focusedMs: 5000, inViewportMs: 5000, cvrPct: 100, scrollEvents: 5, scrollDepthPct: 40, scrollSpeedMax: 500, pointerMoves: 10, pointerCells: 6, touchEvents: 0, keyEvents: 0, tabSwitches: 0 }, score: 0.9, verdict: "pay", weight: 1, amount: 100, reasons: [], scorerVersion: "1.0.0" },
        LOG_SECRET,
      ),
    ];
    const expectedCanonical = expectedRecords.map(canonicalTickRecordJson);
    const expectedRoot = computeLogRoot(expectedCanonical);

    const itemId = await seedConfirmedBatchItem(pg, linkId, 1, 300, expectedRoot, [id2, id0, id1]);

    const result = await rebuildRecordsForItem(pg, itemId, LOG_SECRET);
    expect(result.canonicalRecordJsons).toEqual(expectedCanonical);
    expect(Buffer.from(result.root)).toEqual(Buffer.from(expectedRoot));
  });

  it("throws for an item with no assigned ticks", async () => {
    const linkId = "0x" + "bb".repeat(32);
    await seedCampaignAndLink(pg, "0xca" + linkId.slice(4), linkId);
    const itemId = await seedConfirmedBatchItem(pg, linkId, 1, 0, new Uint8Array(32), []);
    await expect(rebuildRecordsForItem(pg, itemId, LOG_SECRET)).rejects.toThrow(/no ticks assigned/);
  });
});
