import type { Pool } from "pg";

/**
 * Records that a module's poll loop just completed a cycle (found events or not) —
 * the liveness signal `estimateIndexerLagMs` (batcher's guards.ts) reads to decide
 * whether the mirror is fresh enough to settle against (spec section 9's "lag metric").
 */
export async function touchHeartbeat(pg: Pool, name: string): Promise<void> {
  await pg.query(
    `INSERT INTO indexer_heartbeat (name, last_polled_at) VALUES ($1, now())
     ON CONFLICT (name) DO UPDATE SET last_polled_at = now()`,
    [name],
  );
}

/** ms since the least-recently-polled module last completed a cycle, or null if none have ever polled. */
export async function getHeartbeatLagMs(pg: Pool, nowMs: number): Promise<number | null> {
  const { rows } = await pg.query(`SELECT MIN(last_polled_at) AS oldest FROM indexer_heartbeat`);
  const oldest = rows[0]?.oldest;
  if (!oldest) return null;
  return nowMs - new Date(oldest).getTime();
}
