import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { resolveUnknownOutcome } from "../src/unknownOutcome.js";
import { createTestDatabase, seedCampaignAndLink } from "./testHarness.js";
import { FakeChainClient } from "./fakeChainClient.js";

let pg: Pool;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_batcher_unknown_outcome_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links, accruals, sessions, ticks, batches, batch_items CASCADE");
});

afterAll(async () => {
  await pg.end();
});

async function seedInFlightBatch(linkId: string, digest: string, expiresAtMs: number) {
  const { rows } = await pg.query(`INSERT INTO batches (status, tx_digest) VALUES ('submitted', $1) RETURNING batch_id`, [digest]);
  const batchId = rows[0].batch_id;
  await pg.query(
    `INSERT INTO batch_items (batch_id, link_id, seq, amount, seconds_verified, log_root, expires_at_ms, signature, status)
     VALUES ($1, $2, 0, 1000, 60, '\\x00', $3, '\\x00', 'submitted')`,
    [batchId, linkId, expiresAtMs],
  );
  return batchId;
}

describe("resolveUnknownOutcome", () => {
  it("treats a found, successful transaction as confirmed", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "01".repeat(32) });
    const batchId = await seedInFlightBatch(linkId, "digest-found-success", 4102444800000);

    const chain = new FakeChainClient();
    chain.transactionOutcomes.set("digest-found-success", { digest: "digest-found-success", success: true, abortCode: null, error: null });

    const resolution = await resolveUnknownOutcome(chain, pg, batchId, "digest-found-success", 4102444800000, Date.now());
    expect(resolution).toBe("confirmed");
    const { rows } = await pg.query("SELECT status FROM batches WHERE batch_id = $1", [batchId]);
    expect(rows[0].status).toBe("confirmed");
  });

  it("treats a found, failed transaction as failed and releases its ticks", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "02".repeat(32) });
    const batchId = await seedInFlightBatch(linkId, "digest-found-fail", 4102444800000);
    await pg.query(
      `INSERT INTO sessions (session_id, link_id, started_at, last_seen_at, ip_hash, ip_class) VALUES ('11111111-1111-1111-1111-111111111111', $1, now(), now(), '\\x00', 'residential')`,
      [linkId],
    );
    const { rows: itemRows } = await pg.query("SELECT item_id FROM batch_items WHERE batch_id = $1", [batchId]);
    await pg.query(
      `INSERT INTO ticks (session_id, link_id, seq, received_at, features, score, verdict, weight, amount, scorer_version, batch_item_id)
       VALUES ('11111111-1111-1111-1111-111111111111', $1, 1, now(), '{}', 0.9, 'pay', 1.0, 1000, '1.0.0', $2)`,
      [linkId, itemRows[0].item_id],
    );

    const chain = new FakeChainClient();
    chain.transactionOutcomes.set("digest-found-fail", { digest: "digest-found-fail", success: false, abortCode: "13", error: "E_BUDGET" });

    const resolution = await resolveUnknownOutcome(chain, pg, batchId, "digest-found-fail", 4102444800000, Date.now());
    expect(resolution).toBe("failed");

    const { rows: batchRows } = await pg.query("SELECT status, error FROM batches WHERE batch_id = $1", [batchId]);
    expect(batchRows[0].status).toBe("failed");
    expect(batchRows[0].error).toBe("E_BUDGET");

    const { rows: tickRows } = await pg.query("SELECT batch_item_id FROM ticks WHERE link_id = $1", [linkId]);
    expect(tickRows[0].batch_item_id).toBeNull();
  });

  it("reports still_pending when not found and not yet past expiry + margin", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "03".repeat(32) });
    const nowMs = 1_800_000_000_000;
    const expiresAtMs = nowMs + 10_000; // expires in the future
    const batchId = await seedInFlightBatch(linkId, "digest-not-found-fresh", expiresAtMs);

    const chain = new FakeChainClient(); // no outcome registered => "not found"
    const resolution = await resolveUnknownOutcome(chain, pg, batchId, "digest-not-found-fresh", expiresAtMs, nowMs);
    expect(resolution).toBe("still_pending");

    const { rows } = await pg.query("SELECT status FROM batches WHERE batch_id = $1", [batchId]);
    expect(rows[0].status).toBe("submitted"); // untouched
  });

  it("finalizes as failed once not found AND past expiry + the 15s margin", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "04".repeat(32) });
    const nowMs = 1_800_000_000_000;
    const expiresAtMs = nowMs - 20_000; // expired 20s ago, past the 15s margin
    const batchId = await seedInFlightBatch(linkId, "digest-not-found-expired", expiresAtMs);

    const chain = new FakeChainClient();
    const resolution = await resolveUnknownOutcome(chain, pg, batchId, "digest-not-found-expired", expiresAtMs, nowMs);
    expect(resolution).toBe("failed");

    const { rows } = await pg.query("SELECT status FROM batches WHERE batch_id = $1", [batchId]);
    expect(rows[0].status).toBe("failed");
  });

  it("does not finalize within the 15s margin even after nominal expiry", async () => {
    const { linkId } = await seedCampaignAndLink(pg, { linkId: "0x" + "05".repeat(32) });
    const nowMs = 1_800_000_000_000;
    const expiresAtMs = nowMs - 5_000; // expired, but only 5s ago (< 15s margin)
    const batchId = await seedInFlightBatch(linkId, "digest-not-found-margin", expiresAtMs);

    const chain = new FakeChainClient();
    const resolution = await resolveUnknownOutcome(chain, pg, batchId, "digest-not-found-margin", expiresAtMs, nowMs);
    expect(resolution).toBe("still_pending");
  });
});
