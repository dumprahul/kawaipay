import type { Pool, PoolClient } from "pg";

/** Arbitrary, fixed advisory lock key for "the one active batcher instance" (spec section 8). */
export const BATCHER_LOCK_KEY = 872134901;

/**
 * Postgres session advisory locks are tied to a single connection, so the leader must
 * hold one dedicated client for as long as it stays leader — never let it back into the
 * pool. Returns null if another instance already holds the lock.
 */
export async function tryAcquireLeader(pg: Pool, lockKey: number = BATCHER_LOCK_KEY): Promise<PoolClient | null> {
  const client = await pg.connect();
  const { rows } = await client.query(`SELECT pg_try_advisory_lock($1) AS acquired`, [lockKey]);
  if (rows[0].acquired) {
    return client;
  }
  client.release();
  return null;
}

export async function releaseLeader(client: PoolClient, lockKey: number = BATCHER_LOCK_KEY): Promise<void> {
  await client.query(`SELECT pg_advisory_unlock($1)`, [lockKey]);
  client.release();
}
