import type { Pool } from "pg";
import { bytesToHex } from "@kawaipay/shared";

export interface SettlementHistoryEntry {
  seq: number;
  amount: number;
  secondsVerified: number;
  logRoot: string; // hex — this is what an outsider compares against a re-derived Merkle root
  logBlobId: string | null; // null until the log-writer has uploaded this settlement's log
  txDigest: string;
  checkpoint: number;
  settledAt: string; // ISO 8601
}

export interface LinkHistoryPage {
  linkId: string;
  settlements: SettlementHistoryEntry[];
  nextBeforeSeq: number | null;
}

const MAX_PAGE_SIZE = 100;

/**
 * The public audit entry point (spec section 11): everything the audit CLI (G2) needs to
 * verify a link's payouts without any access to our own systems beyond this endpoint —
 * the on-chain log_root plus the blob ID for the log that should hash to it. Ordered
 * newest-seq-first since that's what a creator or auditor checking on a link usually wants.
 */
export async function getLinkHistory(
  pg: Pool,
  linkId: string,
  opts: { limit?: number; beforeSeq?: number } = {},
): Promise<LinkHistoryPage | null> {
  const { rows: linkRows } = await pg.query(`SELECT 1 FROM links WHERE link_id = $1`, [linkId]);
  if (linkRows.length === 0) {
    return null;
  }

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), MAX_PAGE_SIZE);
  const { rows } = await pg.query(
    `SELECT s.seq, s.amount, s.seconds_verified, s.log_root, s.checkpoint, s.ts, s.tx_digest, bi.log_blob_id
     FROM settlements s
     LEFT JOIN batch_items bi ON bi.link_id = s.link_id AND bi.seq = s.seq AND bi.status = 'confirmed'
     WHERE s.link_id = $1 AND ($2::bigint IS NULL OR s.seq < $2)
     ORDER BY s.seq DESC
     LIMIT $3`,
    [linkId, opts.beforeSeq ?? null, limit + 1],
  );

  const page = rows.slice(0, limit);
  const settlements: SettlementHistoryEntry[] = page.map((r) => ({
    seq: Number(r.seq),
    amount: Number(r.amount),
    secondsVerified: Number(r.seconds_verified),
    logRoot: bytesToHex(new Uint8Array(r.log_root)),
    logBlobId: r.log_blob_id ?? null,
    txDigest: r.tx_digest,
    checkpoint: Number(r.checkpoint),
    settledAt: new Date(r.ts).toISOString(),
  }));

  return {
    linkId,
    settlements,
    nextBeforeSeq: rows.length > limit ? settlements[settlements.length - 1]!.seq : null,
  };
}
