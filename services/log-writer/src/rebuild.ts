import type { Pool } from "pg";
import { buildTickLogRecord, canonicalTickRecordJson, computeLogRoot, type IpClass, type Verdict } from "@kawaipay/shared";

/**
 * Rebuilds a confirmed batch item's canonical tick records from the ticks assigned to
 * it, in the same order the batcher selected them (received_at ascending — spec section
 * 11), and recomputes their Merkle root. Uses `buildTickLogRecord`, the same construction
 * the batcher uses when it first computes `batch_items.log_root`, so a match here proves
 * the persisted root is reproducible from the underlying ticks.
 */
export async function rebuildRecordsForItem(
  pg: Pool,
  itemId: number,
  logSecret: string,
): Promise<{ canonicalRecordJsons: string[]; root: Uint8Array }> {
  const { rows } = await pg.query(
    `SELECT t.session_id, t.received_at, t.seq, t.server_gap_ms, t.features, t.score, t.verdict, t.weight, t.amount, t.reasons, t.scorer_version, s.ip_class
     FROM ticks t
     JOIN sessions s ON s.session_id = t.session_id
     WHERE t.batch_item_id = $1
     ORDER BY t.received_at ASC`,
    [itemId],
  );
  const canonicalRecordJsons = rows.map((r) =>
    canonicalTickRecordJson(
      buildTickLogRecord(
        {
          sessionId: r.session_id,
          receivedAt: new Date(r.received_at),
          seq: r.seq,
          serverGapMs: r.server_gap_ms,
          ipClass: r.ip_class as IpClass,
          features: r.features,
          score: Number(r.score),
          verdict: r.verdict as Verdict,
          weight: Number(r.weight),
          amount: Number(r.amount),
          reasons: r.reasons as string[],
          scorerVersion: r.scorer_version as string,
        },
        logSecret,
      ),
    ),
  );
  if (canonicalRecordJsons.length === 0) {
    throw new Error(`batch item ${itemId} has no ticks assigned to it`);
  }
  return { canonicalRecordJsons, root: computeLogRoot(canonicalRecordJsons) };
}
