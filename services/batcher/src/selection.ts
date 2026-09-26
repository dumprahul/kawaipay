import type { Pool, PoolClient } from "pg";
import { buildAttestation, type CandidateTick, type LinkSettleContext, type Signer } from "@kawaipay/oracle-core";
import { buildTickLogRecord, type BucketedStats, type IpClass, type Verdict } from "@kawaipay/shared";

export interface CandidateLink {
  linkId: string;
  campaignId: string;
  creator: string;
  budgetRemaining: number;
  nextSeq: number;
  maxRatePerSecond: number;
  perSettleCap: number;
}

/**
 * Links with unbatched, earning ticks, not frozen, with no batch item already in
 * building/submitted for them, oldest pending tick first (spec section 8, step 2).
 */
export async function selectEligibleLinks(pg: Pool, limit: number): Promise<CandidateLink[]> {
  const { rows } = await pg.query(
    `SELECT l.link_id, l.campaign_id, l.creator, l.budget_remaining, l.next_seq, c.max_rate_per_second, c.per_settle_cap,
            MIN(t.received_at) AS oldest_pending_at
     FROM links l
     JOIN campaigns c ON c.campaign_id = l.campaign_id
     JOIN ticks t ON t.link_id = l.link_id AND t.batch_item_id IS NULL AND t.amount > 0
     WHERE l.frozen = false
       AND NOT EXISTS (
         SELECT 1 FROM batch_items bi WHERE bi.link_id = l.link_id AND bi.status IN ('building', 'submitted')
       )
     GROUP BY l.link_id, l.campaign_id, l.creator, l.budget_remaining, l.next_seq, c.max_rate_per_second, c.per_settle_cap
     ORDER BY oldest_pending_at ASC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    linkId: r.link_id,
    campaignId: r.campaign_id,
    creator: r.creator,
    budgetRemaining: Number(r.budget_remaining),
    nextSeq: Number(r.next_seq),
    maxRatePerSecond: Number(r.max_rate_per_second),
    perSettleCap: Number(r.per_settle_cap),
  }));
}

async function fetchCandidateTicks(client: PoolClient, linkId: string, logSecret: string): Promise<CandidateTick[]> {
  const { rows } = await client.query(
    `SELECT t.tick_id, t.session_id, t.seq, t.received_at, t.server_gap_ms, t.features, t.score, t.verdict, t.weight, t.amount, t.reasons, t.scorer_version, s.ip_class
     FROM ticks t
     JOIN sessions s ON s.session_id = t.session_id
     WHERE t.link_id = $1 AND t.batch_item_id IS NULL AND t.amount > 0
     ORDER BY t.received_at ASC`,
    [linkId],
  );
  return rows.map((r) => ({
    tickId: String(r.tick_id),
    receivedAtMs: new Date(r.received_at).getTime(),
    record: buildTickLogRecord(
      {
        sessionId: r.session_id,
        receivedAt: new Date(r.received_at),
        seq: r.seq,
        serverGapMs: r.server_gap_ms,
        ipClass: r.ip_class as IpClass,
        features: r.features as BucketedStats,
        score: Number(r.score),
        verdict: r.verdict as Verdict,
        weight: Number(r.weight),
        amount: Number(r.amount),
        reasons: r.reasons as string[],
        scorerVersion: r.scorer_version as string,
      },
      logSecret,
    ),
  }));
}

export interface ReservedItem {
  itemId: number;
  batchId: number;
  campaignId: string;
  linkId: string;
  seq: number;
  secondsVerified: number;
  amount: number;
  logRoot: Uint8Array;
  expiresAtMs: number;
  signature: Uint8Array;
}

export interface ReserveResult {
  batchId: number | null;
  items: ReservedItem[];
  alerts: { linkId: string; reason: string; detail: unknown }[];
}

/**
 * Reserves one batch: creates the batches row, builds + signs an attestation per
 * eligible link, and assigns their ticks to the new batch_items rows — all in one
 * Postgres transaction (spec section 8, step 3). If no link actually produced an
 * attestation (all skipped or alerted), the transaction is rolled back and no empty
 * batch is left behind.
 */
export async function reserveBatch(
  pg: Pool,
  signer: Signer,
  links: CandidateLink[],
  logSecret: string,
  nowMs: number,
): Promise<ReserveResult> {
  const client = await pg.connect();
  const alerts: ReserveResult["alerts"] = [];
  const items: ReservedItem[] = [];

  try {
    await client.query("BEGIN");
    const { rows: batchRows } = await client.query(`INSERT INTO batches (status) VALUES ('building') RETURNING batch_id`);
    const batchId = Number(batchRows[0].batch_id);

    for (const link of links) {
      const candidates = await fetchCandidateTicks(client, link.linkId, logSecret);
      const ctx: LinkSettleContext = {
        campaignId: link.campaignId,
        linkId: link.linkId,
        nextSeq: link.nextSeq,
        budgetRemaining: link.budgetRemaining,
        maxRatePerSecond: link.maxRatePerSecond,
        perSettleCap: link.perSettleCap,
        nowMs,
      };
      const result = await buildAttestation(ctx, candidates, signer);

      if (result.kind === "skipped") {
        continue; // ticks stay pending, tried again next cycle
      }
      if (result.kind === "alert") {
        alerts.push({ linkId: link.linkId, reason: result.reason, detail: result });
        continue; // this link's ticks stay pending; do not fail the whole cycle
      }

      const { rows: itemRows } = await client.query(
        `INSERT INTO batch_items (batch_id, link_id, seq, amount, seconds_verified, log_root, expires_at_ms, signature, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'building')
         RETURNING item_id`,
        [
          batchId,
          link.linkId,
          result.attestation.seq,
          result.attestation.amount,
          result.attestation.secondsVerified,
          Buffer.from(result.attestation.logRoot),
          result.attestation.expiresAtMs,
          Buffer.from(result.signature),
        ],
      );
      const itemId = Number(itemRows[0].item_id);

      await client.query(`UPDATE ticks SET batch_item_id = $1 WHERE tick_id = ANY($2::bigint[])`, [
        itemId,
        result.selectedTickIds.map(Number),
      ]);

      items.push({
        itemId,
        batchId,
        campaignId: link.campaignId,
        linkId: link.linkId,
        seq: result.attestation.seq,
        secondsVerified: result.attestation.secondsVerified,
        amount: result.attestation.amount,
        logRoot: result.attestation.logRoot,
        expiresAtMs: result.attestation.expiresAtMs,
        signature: result.signature,
      });
    }

    if (items.length === 0) {
      await client.query("ROLLBACK");
      return { batchId: null, items: [], alerts };
    }

    await client.query("COMMIT");
    return { batchId, items, alerts };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Releases a batch item's ticks back to pending and marks it failed (used by bisection,
 * on-chain abort, and unknown-outcome resolution). `reason` has nowhere to persist
 * per-item (batch_items has no error column — only batches.error does), so it's logged
 * here rather than silently dropped.
 */
export async function releaseItem(pg: Pool, itemId: number, reason: string): Promise<void> {
  console.error(JSON.stringify({ msg: "releasing batch item", itemId, reason }));
  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE ticks SET batch_item_id = NULL WHERE batch_item_id = $1`, [itemId]);
    await client.query(`UPDATE batch_items SET status = 'failed' WHERE item_id = $1`, [itemId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function markBatchStatus(pg: Pool, batchId: number, status: string, error?: string, txDigest?: string): Promise<void> {
  await pg.query(
    `UPDATE batches SET status = $2, error = $3, tx_digest = COALESCE($4, tx_digest),
       submitted_at = CASE WHEN $2 = 'submitted' THEN now() ELSE submitted_at END,
       confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE confirmed_at END
     WHERE batch_id = $1`,
    [batchId, status, error ?? null, txDigest ?? null],
  );
}

export async function markItemStatus(pg: Pool, itemId: number, status: string): Promise<void> {
  await pg.query(`UPDATE batch_items SET status = $2 WHERE item_id = $1`, [itemId, status]);
}
