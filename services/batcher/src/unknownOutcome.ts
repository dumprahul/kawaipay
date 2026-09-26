import type { Pool } from "pg";
import type { ChainClient } from "./chainClient.js";
import { markBatchStatus, releaseItem } from "./selection.js";

export type UnknownOutcomeResolution = "confirmed" | "failed" | "still_pending";

async function getUnconfirmedItemIds(pg: Pool, batchId: number): Promise<number[]> {
  const { rows } = await pg.query(`SELECT item_id FROM batch_items WHERE batch_id = $1 AND status IN ('building', 'submitted')`, [batchId]);
  return rows.map((r) => Number(r.item_id));
}

/**
 * Resolves a batch whose submit outcome is unknown — a timeout, a lost response, or a
 * crash right after `signAndSubmit` (spec section 8, "Unknown outcomes are safe to
 * resolve"). Safe to call repeatedly: before the attestations expire it just reports
 * "still pending"; once expiry + a 15s margin has passed, a not-found digest can never
 * land (ATT_TTL_MS guarantees that), so it's finalized as failed and the ticks released.
 */
export async function resolveUnknownOutcome(
  chain: ChainClient,
  pg: Pool,
  batchId: number,
  digest: string,
  maxExpiresAtMs: number,
  nowMs: number,
): Promise<UnknownOutcomeResolution> {
  const outcome = await chain.getTransactionOutcome(digest);

  if (outcome) {
    if (outcome.success) {
      await markBatchStatus(pg, batchId, "confirmed");
      return "confirmed";
    }
    const itemIds = await getUnconfirmedItemIds(pg, batchId);
    for (const itemId of itemIds) {
      await releaseItem(pg, itemId, outcome.error ?? "on-chain abort");
    }
    await markBatchStatus(pg, batchId, "failed", outcome.error ?? `abort code ${outcome.abortCode ?? "unknown"}`);
    return "failed";
  }

  const EXPIRY_MARGIN_MS = 15_000;
  if (nowMs < maxExpiresAtMs + EXPIRY_MARGIN_MS) {
    return "still_pending";
  }

  const itemIds = await getUnconfirmedItemIds(pg, batchId);
  for (const itemId of itemIds) {
    await releaseItem(pg, itemId, "transaction not found on chain after attestation expiry — assumed lost");
  }
  await markBatchStatus(pg, batchId, "failed", "transaction not found after expiry");
  return "failed";
}
