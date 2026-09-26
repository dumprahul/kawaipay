import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_URL = process.env.POSTGRES_ADMIN_URL ?? "postgres://localhost/postgres";
const TEST_DB = "kawaipay_constraints_test";

let client: Client;

async function runQuery(sql: string, params: unknown[] = []) {
  return client.query(sql, params);
}

async function expectViolation(sql: string, params: unknown[], match: RegExp) {
  await expect(runQuery(sql, params)).rejects.toThrow(match);
}

async function insertCampaign(id: string) {
  await runQuery(
    `INSERT INTO campaigns (campaign_id, seller, coin_type, rate_per_second, max_rate_per_second, per_settle_cap, per_link_epoch_cap, active, open_links)
     VALUES ($1, '0xseller', '0x2::sui::SUI', 200, 400, 100000, 5000000, true, true)`,
    [id],
  );
}

async function insertLink(id: string, campaignId: string) {
  await runQuery(`INSERT INTO links (link_id, campaign_id, creator) VALUES ($1, $2, '0xcreator')`, [id, campaignId]);
}

async function insertSession(id: string, linkId: string) {
  await runQuery(
    `INSERT INTO sessions (session_id, link_id, started_at, last_seen_at, ip_hash, ip_class)
     VALUES ($1, $2, now(), now(), '\\x00', 'residential')`,
    [id, linkId],
  );
}

beforeAll(async () => {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [TEST_DB],
  );
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  const testDbUrl = new URL(ADMIN_URL);
  testDbUrl.pathname = `/${TEST_DB}`;
  client = new Client({ connectionString: testDbUrl.toString() });
  await client.connect();

  const migration = readFileSync(join(__dirname, "../migrations/0001_init.sql"), "utf8");
  await client.query(migration);
}, 30_000);

afterAll(async () => {
  await client.end();
});

describe("0001_init.sql constraints, applied to a real Postgres instance", () => {
  it("migration created every table from spec section 4", async () => {
    const { rows } = await runQuery(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(
      [
        "accruals",
        "batch_items",
        "batches",
        "campaigns",
        "indexer_cursor",
        "indexer_heartbeat",
        "link_risk",
        "links",
        "risk_flags",
        "sessions",
        "settlements",
        "ticks",
        "used_payments",
      ].sort(),
    );
  });

  it("rejects a link referencing a non-existent campaign (FK)", async () => {
    await expectViolation(
      `INSERT INTO links (link_id, campaign_id, creator) VALUES ('link-orphan', 'campaign-does-not-exist', '0xcreator')`,
      [],
      /foreign key/i,
    );
  });

  it("enforces UNIQUE(session_id, seq) on ticks", async () => {
    await insertCampaign("campaign-ticks");
    await insertLink("link-ticks", "campaign-ticks");
    await insertSession("11111111-1111-1111-1111-111111111111", "link-ticks");

    const insertTick = () =>
      runQuery(
        `INSERT INTO ticks (session_id, link_id, seq, received_at, features, score, verdict, weight, amount, scorer_version)
         VALUES ($1, 'link-ticks', 1, now(), '{}'::jsonb, 0.9, 'pay', 1.0, 1000, '1.0.0')`,
        ["11111111-1111-1111-1111-111111111111"],
      );
    await insertTick();
    await expect(insertTick()).rejects.toThrow(/duplicate key value violates unique constraint/i);
  });

  it("rejects an invalid tick verdict (CHECK constraint)", async () => {
    await insertSession("22222222-2222-2222-2222-222222222222", "link-ticks");
    await expectViolation(
      `INSERT INTO ticks (session_id, link_id, seq, received_at, features, score, verdict, weight, amount, scorer_version)
       VALUES ($1, 'link-ticks', 1, now(), '{}'::jsonb, 0.9, 'not_a_real_verdict', 1.0, 1000, '1.0.0')`,
      ["22222222-2222-2222-2222-222222222222"],
      /violates check constraint/i,
    );
  });

  it("rejects an invalid batch status (CHECK constraint)", async () => {
    await expectViolation(`INSERT INTO batches (status) VALUES ('not_a_real_status')`, [], /violates check constraint/i);
  });

  it("rejects an invalid risk_flags level (CHECK constraint)", async () => {
    await insertCampaign("campaign-risk");
    await insertLink("link-risk-flags", "campaign-risk");
    await expectViolation(
      `INSERT INTO risk_flags (link_id, rule, level, evidence) VALUES ('link-risk-flags', 'TEST_RULE', 4, '{}'::jsonb)`,
      [],
      /violates check constraint/i,
    );
  });

  it("enforces one_live_item_per_link_seq: two building/submitted/confirmed items for the same (link_id, seq) collide", async () => {
    await insertCampaign("campaign-batch");
    await insertLink("link-batch", "campaign-batch");
    const { rows } = await runQuery(`INSERT INTO batches (status) VALUES ('building') RETURNING batch_id`);
    const batchId = rows[0].batch_id;

    const insertItem = (status: string) =>
      runQuery(
        `INSERT INTO batch_items (batch_id, link_id, seq, amount, seconds_verified, log_root, expires_at_ms, signature, status)
         VALUES ($1, 'link-batch', 0, 1000, 60, '\\x00', 0, '\\x00', $2)`,
        [batchId, status],
      );

    await insertItem("building");
    await expect(insertItem("submitted")).rejects.toThrow(/duplicate key value violates unique constraint/i);
  });

  it("allows a new live item for the same (link_id, seq) once the prior one is failed", async () => {
    await insertCampaign("campaign-batch-2");
    await insertLink("link-batch-2", "campaign-batch-2");
    const { rows } = await runQuery(`INSERT INTO batches (status) VALUES ('failed') RETURNING batch_id`);
    const batchId = rows[0].batch_id;

    const insertItem = (status: string) =>
      runQuery(
        `INSERT INTO batch_items (batch_id, link_id, seq, amount, seconds_verified, log_root, expires_at_ms, signature, status)
         VALUES ($1, 'link-batch-2', 0, 1000, 60, '\\x00', 0, '\\x00', $2)`,
        [batchId, status],
      );

    await insertItem("failed");
    // Same (link_id, seq) again, but this time as 'building' — the partial index only
    // covers building/submitted/confirmed, and the first row is 'failed', so this succeeds.
    await expect(insertItem("building")).resolves.toBeDefined();
  });

  it("enforces PRIMARY KEY (tx_digest, event_seq) on settlements", async () => {
    const insertSettlement = () =>
      runQuery(
        `INSERT INTO settlements (tx_digest, event_seq, link_id, seq, amount, seconds_verified, log_root, checkpoint, ts)
         VALUES ('digest-1', 0, 'link-batch', 0, 1000, 60, '\\x00', 1, now())`,
      );
    await insertSettlement();
    await expect(insertSettlement()).rejects.toThrow(/duplicate key value violates unique constraint/i);
  });
});
