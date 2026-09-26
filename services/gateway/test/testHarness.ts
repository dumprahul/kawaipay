import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client, Pool } from "pg";
import Redis from "ioredis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_URL = process.env.POSTGRES_ADMIN_URL ?? "postgres://localhost/postgres";
export const REDIS_URL = process.env.GATEWAY_TEST_REDIS_URL ?? "redis://127.0.0.1:6390";

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

export function createTestRedis(): Redis {
  return new Redis(REDIS_URL);
}

export async function seedCampaignAndLink(
  pool: Pool,
  overrides: Partial<{
    campaignId: string;
    linkId: string;
    seller: string;
    active: boolean;
    frozen: boolean;
    budgetRemaining: number;
    ratePerSecond: number;
    maxRatePerSecond: number;
  }> = {},
) {
  const linkId = overrides.linkId ?? "0x" + "bb".repeat(32);
  const campaignId = overrides.campaignId ?? `campaign-for-${linkId}`;
  await pool.query(
    `INSERT INTO campaigns (campaign_id, seller, coin_type, rate_per_second, max_rate_per_second, per_settle_cap, per_link_epoch_cap, active, open_links)
     VALUES ($1, $5, '0x2::sui::SUI', $2, $3, 100000, 5000000, $4, true)`,
    [campaignId, overrides.ratePerSecond ?? 200, overrides.maxRatePerSecond ?? 1000, overrides.active ?? true, overrides.seller ?? "0xseller"],
  );
  await pool.query(
    `INSERT INTO links (link_id, campaign_id, creator, frozen, budget_remaining) VALUES ($1, $2, '0xcreator', $3, $4)`,
    [linkId, campaignId, overrides.frozen ?? false, overrides.budgetRemaining ?? 1_000_000],
  );
  return { campaignId, linkId };
}
