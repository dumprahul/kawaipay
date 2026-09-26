import type { Pool } from "pg";
import { bytesToHex, emitAlert } from "@kawaipay/shared";
import { buildLogFile, headerFor, logKey } from "./logFile.js";
import { rebuildRecordsForItem } from "./rebuild.js";
import { retryWithBackoff } from "./retry.js";
import type { LogStore } from "./logStore.js";
import type { LogWriterMetrics } from "./metrics.js";

export interface PendingItem {
  itemId: number;
  linkId: string;
  campaignId: string;
  seq: number;
  logRoot: Uint8Array;
  scorerVersion: string;
}

/** Confirmed batch items whose log hasn't been written yet (spec section 11's driver query). */
export async function findPendingItems(pg: Pool): Promise<PendingItem[]> {
  const { rows } = await pg.query(
    `SELECT bi.item_id, bi.link_id, l.campaign_id, bi.seq, bi.log_root,
            (SELECT t.scorer_version FROM ticks t WHERE t.batch_item_id = bi.item_id LIMIT 1) AS scorer_version
     FROM batch_items bi
     JOIN links l ON l.link_id = bi.link_id
     WHERE bi.status = 'confirmed' AND bi.log_blob_id IS NULL
     ORDER BY bi.item_id ASC`,
  );
  return rows.map((r) => ({
    itemId: Number(r.item_id),
    linkId: r.link_id,
    campaignId: r.campaign_id,
    seq: Number(r.seq),
    logRoot: new Uint8Array(r.log_root),
    scorerVersion: r.scorer_version as string,
  }));
}

export type WriteOutcome =
  | { kind: "written"; itemId: number; blobId: string }
  | { kind: "root_mismatch"; itemId: number; expected: string; recomputed: string }
  | { kind: "upload_failed"; itemId: number; error: string };

/**
 * Rebuilds one confirmed item's log from its ticks, checks the recomputed root against
 * the one already on `batch_items.log_root` (never uploading on a mismatch — spec section
 * 11, step 2), uploads it, and records the returned blob ID.
 */
export async function writeLogForItem(
  pg: Pool,
  logStore: LogStore,
  item: PendingItem,
  logSecret: string,
  retryOpts: { maxAttempts: number; baseDelayMs: number; maxDelayMs: number } = {
    maxAttempts: 5,
    baseDelayMs: 200,
    maxDelayMs: 5_000,
  },
  metrics?: LogWriterMetrics,
): Promise<WriteOutcome> {
  const { canonicalRecordJsons, root } = await rebuildRecordsForItem(pg, item.itemId, logSecret);
  const recomputedHex = bytesToHex(root);
  const expectedHex = bytesToHex(item.logRoot);
  if (recomputedHex !== expectedHex) {
    emitAlert("log-writer", "critical", "LOG_ROOT_MISMATCH", "recomputed root does not match batch_items.log_root — refusing to upload", {
      itemId: item.itemId,
      expected: expectedHex,
      recomputed: recomputedHex,
    });
    metrics?.rootMismatches.inc();
    return { kind: "root_mismatch", itemId: item.itemId, expected: expectedHex, recomputed: recomputedHex };
  }

  const key = logKey(item.linkId, item.seq);
  const bytes = buildLogFile(headerFor(item.linkId, item.campaignId, item.seq, root, item.scorerVersion), canonicalRecordJsons);

  try {
    const { blobId } = await retryWithBackoff(() => logStore.put(key, bytes), retryOpts);
    await pg.query(`UPDATE batch_items SET log_blob_id = $1 WHERE item_id = $2`, [blobId, item.itemId]);
    metrics?.logsWritten.inc();
    return { kind: "written", itemId: item.itemId, blobId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emitAlert("log-writer", "warning", "LOG_UPLOAD_FAILED", "log upload failed after exhausting retries", { itemId: item.itemId, error: message });
    metrics?.uploadFailures.inc();
    return { kind: "upload_failed", itemId: item.itemId, error: message };
  }
}

/** One log-writer cycle: every confirmed item still missing a log gets attempted, independently. */
export async function writePendingLogs(pg: Pool, logStore: LogStore, logSecret: string, metrics?: LogWriterMetrics): Promise<WriteOutcome[]> {
  const pending = await findPendingItems(pg);
  const outcomes: WriteOutcome[] = [];
  for (const item of pending) {
    outcomes.push(await writeLogForItem(pg, logStore, item, logSecret, undefined, metrics));
  }
  return outcomes;
}
