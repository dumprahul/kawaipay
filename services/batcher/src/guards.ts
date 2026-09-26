import type { Pool } from "pg";

export type GuardFailure = "INDEXER_LAG_TOO_HIGH" | "BATCH_ALREADY_SUBMITTED" | "RELAYER_BALANCE_TOO_LOW";

export interface GuardInputs {
  indexerLagMs: number;
  hasSubmittedBatch: boolean;
  relayerSuiBalance: number;
}

export interface GuardLimits {
  mirrorMaxLagMs: number;
  relayerMinSui: number;
}

/** Spec section 8, step 1. Pure so every branch is trivially unit-testable. */
export function checkGuards(inputs: GuardInputs, limits: GuardLimits): GuardFailure | null {
  if (inputs.indexerLagMs > limits.mirrorMaxLagMs) return "INDEXER_LAG_TOO_HIGH";
  if (inputs.hasSubmittedBatch) return "BATCH_ALREADY_SUBMITTED";
  if (inputs.relayerSuiBalance < limits.relayerMinSui) return "RELAYER_BALANCE_TOO_LOW";
  return null;
}

export async function hasSubmittedBatch(pg: Pool): Promise<boolean> {
  const { rows } = await pg.query(`SELECT EXISTS (SELECT 1 FROM batches WHERE status = 'submitted') AS exists`);
  return rows[0].exists as boolean;
}

/**
 * ms since the indexer's least-recently-polled module last completed a poll cycle (spec
 * section 9's "lag metric"), read from `indexer_heartbeat` — touched by every module's
 * poll loop whether or not it found new events (services/indexer/src/heartbeat.ts). If
 * the indexer has never run at all, there's no way to know it's caught up, so this
 * returns +Infinity — safely failing the INDEXER_LAG_TOO_HIGH guard closed rather than
 * silently assuming freshness.
 */
export async function estimateIndexerLagMs(pg: Pool): Promise<number> {
  const { rows } = await pg.query(`SELECT MIN(last_polled_at) AS oldest FROM indexer_heartbeat`);
  const oldest = rows[0]?.oldest;
  if (!oldest) return Number.POSITIVE_INFINITY;
  return Date.now() - new Date(oldest).getTime();
}
