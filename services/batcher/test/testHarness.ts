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

export async function seedCampaignAndLink(
  pg: Pool,
  overrides: Partial<{
    campaignId: string;
    linkId: string;
    frozen: boolean;
    budgetRemaining: number;
    nextSeq: number;
    maxRatePerSecond: number;
    perSettleCap: number;
    perLinkEpochCap: number;
  }> = {},
) {
  const linkId = overrides.linkId ?? "0x" + "bb".repeat(32);
  // campaignId must be a real 32-byte hex id: reserveBatch's attestations are BCS-encoded
  // for real, so a synthetic non-hex placeholder (fine in gateway/indexer tests) fails here.
  const campaignId = overrides.campaignId ?? "0xca" + linkId.slice(4);
  await pg.query(
    `INSERT INTO campaigns (campaign_id, seller, coin_type, rate_per_second, max_rate_per_second, per_settle_cap, per_link_epoch_cap, active, open_links)
     VALUES ($1, '0xseller', '0x2::sui::SUI', 200, $2, $3, $4, true, true)`,
    [campaignId, overrides.maxRatePerSecond ?? 1000, overrides.perSettleCap ?? 1_000_000, overrides.perLinkEpochCap ?? 5_000_000],
  );
  await pg.query(
    `INSERT INTO links (link_id, campaign_id, creator, frozen, budget_remaining, next_seq) VALUES ($1, $2, '0xcreator', $3, $4, $5)`,
    [linkId, campaignId, overrides.frozen ?? false, overrides.budgetRemaining ?? 1_000_000, overrides.nextSeq ?? 0],
  );
  return { campaignId, linkId };
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

/** Seeds one session + one unbatched, earning tick for a link (amount > 0, ready to be batched). */
export async function seedTick(
  pg: Pool,
  linkId: string,
  sessionId: string,
  seq: number,
  amount: number,
  receivedAt: Date,
  overrides: Partial<{ verdict: string; ipClass: string }> = {},
) {
  await pg.query(
    `INSERT INTO sessions (session_id, link_id, started_at, last_seen_at, ip_hash, ip_class)
     VALUES ($1, $2, $3, $3, '\\x00', $4)
     ON CONFLICT (session_id) DO NOTHING`,
    [sessionId, linkId, receivedAt, overrides.ipClass ?? "residential"],
  );
  await pg.query(
    `INSERT INTO ticks (session_id, link_id, seq, received_at, server_gap_ms, features, score, verdict, weight, amount, reasons, scorer_version)
     VALUES ($1, $2, $3, $4, 5000, $5, 0.9, $6, 1.0, $7, '{}', '1.0.0')`,
    [sessionId, linkId, seq, receivedAt, JSON.stringify(BASE_STATS), overrides.verdict ?? "pay", amount],
  );
}
