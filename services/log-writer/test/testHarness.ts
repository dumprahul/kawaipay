import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client, Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_URL = process.env.POSTGRES_ADMIN_URL ?? "postgres://localhost/postgres";

export async function createTestDatabase(dbName: string): Promise<Pool> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [dbName]);
  await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  const pool = new Pool({ connectionString: url.toString() });

  const migration = readFileSync(join(__dirname, "../../../db/migrations/0001_init.sql"), "utf8");
  await pool.query(migration);
  return pool;
}

const BASE_STATS = {
  windowMs: 5000,
  visibleMs: 5000,
  focusedMs: 5000,
  inViewportMs: 5000,
  cvrPct: 100,
  scrollEvents: 5,
  scrollDepthPct: 40,
  scrollSpeedMax: 500,
  pointerMoves: 10,
  pointerCells: 6,
  touchEvents: 0,
  keyEvents: 0,
  tabSwitches: 0,
};

export async function seedCampaignAndLink(pg: Pool, campaignId: string, linkId: string) {
  await pg.query(
    `INSERT INTO campaigns (campaign_id, seller, coin_type, rate_per_second, max_rate_per_second, per_settle_cap, per_link_epoch_cap, active, open_links)
     VALUES ($1, '0xseller', '0x2::sui::SUI', 200, 1000, 1000000, 5000000, true, true)`,
    [campaignId],
  );
  await pg.query(`INSERT INTO links (link_id, campaign_id, creator) VALUES ($1, $2, '0xcreator')`, [linkId, campaignId]);
}

export async function seedTick(
  pg: Pool,
  linkId: string,
  sessionId: string,
  seq: number,
  amount: number,
  receivedAt: Date,
  overrides: Partial<{ verdict: string; scorerVersion: string }> = {},
): Promise<number> {
  await pg.query(
    `INSERT INTO sessions (session_id, link_id, started_at, last_seen_at, ip_hash, ip_class)
     VALUES ($1, $2, $3, $3, '\\x00', 'residential')
     ON CONFLICT (session_id) DO NOTHING`,
    [sessionId, linkId, receivedAt],
  );
  const { rows } = await pg.query(
    `INSERT INTO ticks (session_id, link_id, seq, received_at, server_gap_ms, features, score, verdict, weight, amount, reasons, scorer_version)
     VALUES ($1, $2, $3, $4, 5000, $5, 0.9, $6, 1.0, $7, '{}', $8)
     RETURNING tick_id`,
    [sessionId, linkId, seq, receivedAt, JSON.stringify(BASE_STATS), overrides.verdict ?? "pay", amount, overrides.scorerVersion ?? "1.0.0"],
  );
  return Number(rows[0].tick_id);
}

/** Inserts a batch + one batch item, and assigns the given tick_ids to it — mirroring what
 * the batcher's reserveBatch does, so log-writer tests exercise a realistic pre-state. */
export async function seedConfirmedBatchItem(
  pg: Pool,
  linkId: string,
  seq: number,
  amount: number,
  logRoot: Uint8Array,
  tickIds: number[],
): Promise<number> {
  const { rows: batchRows } = await pg.query(`INSERT INTO batches (status) VALUES ('confirmed') RETURNING batch_id`);
  const batchId = Number(batchRows[0].batch_id);
  const { rows: itemRows } = await pg.query(
    `INSERT INTO batch_items (batch_id, link_id, seq, amount, seconds_verified, log_root, expires_at_ms, signature, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '\\x00', 'confirmed')
     RETURNING item_id`,
    [batchId, linkId, seq, amount, tickIds.length, Buffer.from(logRoot), Date.now() + 60_000],
  );
  const itemId = Number(itemRows[0].item_id);
  await pg.query(`UPDATE ticks SET batch_item_id = $1 WHERE tick_id = ANY($2::bigint[])`, [itemId, tickIds]);
  return itemId;
}
