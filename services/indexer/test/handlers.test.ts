import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool, PoolClient } from "pg";
import { dispatchEvent, type HandlerContext } from "../src/handlers.js";
import { createTestDatabase, ev, FakeEventSource } from "./testHarness.js";

let pg: Pool;
let eventSource: FakeEventSource;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_indexer_handlers_test");
  await pg.query(
    `INSERT INTO campaigns (campaign_id, seller, coin_type, rate_per_second, max_rate_per_second, per_settle_cap, per_link_epoch_cap, active, open_links)
     VALUES ('campaign-x', '0xseller', '0x2::sui::SUI', 200, 400, 100000, 5000000, true, true)`,
  );
}, 30_000);

afterAll(async () => {
  await pg.end();
});

async function withTx(fn: (client: PoolClient) => Promise<void>) {
  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    await fn(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function freshCtx(client: PoolClient): HandlerContext {
  return { client, eventSource, log: () => {} };
}

beforeAll(() => {
  eventSource = new FakeEventSource();
});

describe("CampaignCreated", () => {
  it("inserts the campaign, resolving the coin type from the chain object", async () => {
    const campaignId = "campaign-a";
    eventSource.coinTypes.set(campaignId, "0x2::sui::SUI");
    const event = ev("CampaignCreated", "campaign", "tx1", 0, {
      campaign_id: campaignId,
      seller: "0xseller",
      rate_per_second: "200",
      max_rate_per_second: "400",
      per_settle_cap: "100000",
      per_link_epoch_cap: "5000000",
      open_links: true,
    });

    await withTx((client) => dispatchEvent(freshCtx(client), event));

    const { rows } = await pg.query("SELECT * FROM campaigns WHERE campaign_id = $1", [campaignId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].coin_type).toBe("0x2::sui::SUI");
    expect(Number(rows[0].rate_per_second)).toBe(200);
    expect(rows[0].active).toBe(true);
  });

  it("is idempotent: applying the same event twice does not duplicate or error", async () => {
    const campaignId = "campaign-b";
    const event = ev("CampaignCreated", "campaign", "tx2", 0, {
      campaign_id: campaignId,
      seller: "0xseller",
      rate_per_second: "1",
      max_rate_per_second: "2",
      per_settle_cap: "3",
      per_link_epoch_cap: "4",
      open_links: false,
    });
    await withTx((client) => dispatchEvent(freshCtx(client), event));
    await withTx((client) => dispatchEvent(freshCtx(client), event));

    const { rows } = await pg.query("SELECT * FROM campaigns WHERE campaign_id = $1", [campaignId]);
    expect(rows).toHaveLength(1);
  });
});

describe("CampaignUpdated", () => {
  it("updates active/rate/cap columns", async () => {
    const campaignId = "campaign-c";
    await withTx((client) =>
      dispatchEvent(
        freshCtx(client),
        ev("CampaignCreated", "campaign", "tx3", 0, {
          campaign_id: campaignId,
          seller: "0xseller",
          rate_per_second: "1",
          max_rate_per_second: "2",
          per_settle_cap: "3",
          per_link_epoch_cap: "4",
          open_links: true,
        }),
      ),
    );

    await withTx((client) =>
      dispatchEvent(
        freshCtx(client),
        ev("CampaignUpdated", "campaign", "tx4", 0, {
          campaign_id: campaignId,
          active: false,
          rate_per_second: "10",
          max_rate_per_second: "20",
          per_settle_cap: "30",
          per_link_epoch_cap: "40",
        }),
      ),
    );

    const { rows } = await pg.query("SELECT * FROM campaigns WHERE campaign_id = $1", [campaignId]);
    expect(rows[0].active).toBe(false);
    expect(Number(rows[0].rate_per_second)).toBe(10);
  });
});

describe("LinkCreated / LinkFunded / LinkReclaimed", () => {
  it("creates the link + a zeroed accruals row, then funds and reclaims", async () => {
    const linkId = "link-a";
    await withTx((client) =>
      dispatchEvent(freshCtx(client), ev("LinkCreated", "link", "tx5", 0, { link_id: linkId, campaign_id: "campaign-x", creator: "0xcreator" })),
    );

    let { rows } = await pg.query("SELECT * FROM links WHERE link_id = $1", [linkId]);
    expect(rows[0].budget_remaining).toBe("0");
    ({ rows } = await pg.query("SELECT * FROM accruals WHERE link_id = $1", [linkId]));
    expect(rows).toHaveLength(1);

    await withTx((client) => dispatchEvent(freshCtx(client), ev("LinkFunded", "link", "tx6", 0, { link_id: linkId, campaign_id: "campaign-x", amount: "5000" })));
    ({ rows } = await pg.query("SELECT budget_remaining FROM links WHERE link_id = $1", [linkId]));
    expect(Number(rows[0].budget_remaining)).toBe(5000);

    await withTx((client) => dispatchEvent(freshCtx(client), ev("LinkReclaimed", "link", "tx7", 0, { link_id: linkId, campaign_id: "campaign-x", amount: "2000" })));
    ({ rows } = await pg.query("SELECT budget_remaining FROM links WHERE link_id = $1", [linkId]));
    expect(Number(rows[0].budget_remaining)).toBe(3000);
  });
});

describe("LinkFrozen / LinkUnfrozen", () => {
  it("toggles the frozen flag", async () => {
    const linkId = "link-b";
    await withTx((client) => dispatchEvent(freshCtx(client), ev("LinkCreated", "link", "tx8", 0, { link_id: linkId, campaign_id: "campaign-x", creator: "0xc" })));
    await withTx((client) => dispatchEvent(freshCtx(client), ev("LinkFrozen", "link", "tx9", 0, { link_id: linkId })));

    let { rows } = await pg.query("SELECT frozen FROM links WHERE link_id = $1", [linkId]);
    expect(rows[0].frozen).toBe(true);

    await withTx((client) => dispatchEvent(freshCtx(client), ev("LinkUnfrozen", "link", "tx10", 0, { link_id: linkId })));
    ({ rows } = await pg.query("SELECT frozen FROM links WHERE link_id = $1", [linkId]));
    expect(rows[0].frozen).toBe(false);
  });
});

describe("PayoutSettled", () => {
  async function seedLinkWithBatchItem(linkId: string, campaignId: string, batchId: number, seq: number, amount: number) {
    await withTx((client) =>
      dispatchEvent(freshCtx(client), ev("LinkCreated", "link", `seed-${linkId}`, 0, { link_id: linkId, campaign_id: campaignId, creator: "0xc" })),
    );
    await pg.query(`INSERT INTO batches (batch_id, status) VALUES ($1, 'submitted') ON CONFLICT DO NOTHING`, [batchId]);
    await pg.query(
      `INSERT INTO batch_items (batch_id, link_id, seq, amount, seconds_verified, log_root, expires_at_ms, signature, status)
       VALUES ($1, $2, $3, $4, 60, '\\x00', 0, '\\x00', 'submitted')`,
      [batchId, linkId, seq, amount],
    );
  }

  it("inserts the settlement, updates the link and accruals, and confirms the matching batch item", async () => {
    const linkId = "link-settle-1";
    await seedLinkWithBatchItem(linkId, "campaign-x", 1001, 0, 1000);

    const settleEvent = ev("PayoutSettled", "payout", "tx-settle-1", 0, {
      link_id: linkId,
      campaign_id: "campaign-x",
      creator: "0xcreator",
      amount: "1000",
      seq: "0",
      seconds_verified: "60",
      log_root: Array(32).fill(1),
      timestamp_ms: "1800000000000",
    });
    await withTx((client) => dispatchEvent(freshCtx(client), settleEvent));

    const { rows: linkRows } = await pg.query("SELECT next_seq, total_paid, budget_remaining FROM links WHERE link_id = $1", [linkId]);
    expect(Number(linkRows[0].next_seq)).toBe(1);
    expect(Number(linkRows[0].total_paid)).toBe(1000);

    const { rows: accrualRows } = await pg.query("SELECT settled_total FROM accruals WHERE link_id = $1", [linkId]);
    expect(Number(accrualRows[0].settled_total)).toBe(1000);

    const { rows: itemRows } = await pg.query("SELECT status FROM batch_items WHERE link_id = $1 AND seq = 0", [linkId]);
    expect(itemRows[0].status).toBe("confirmed");

    const { rows: batchRows } = await pg.query("SELECT status FROM batches WHERE batch_id = 1001");
    expect(batchRows[0].status).toBe("confirmed");
  });

  it("decodes log_root as base64 — the real GraphQL transport's encoding for vector<u8>, not an array of numbers", async () => {
    // Captured live from a real settle() call on testnet (spec section 9's own warning
    // about the RPC surface evolving, borne out again: this transport encodes
    // vector<u8> event fields as base64 strings, not the array-of-numbers this handler
    // originally assumed).
    const linkId = "link-settle-base64";
    await seedLinkWithBatchItem(linkId, "campaign-x", 1003, 0, 1500);

    const settleEvent = ev("PayoutSettled", "payout", "tx-settle-base64", 0, {
      link_id: linkId,
      campaign_id: "campaign-x",
      creator: "0xcreator",
      amount: "1500",
      seq: "0",
      seconds_verified: "60",
      log_root: "uH2gmbRXjM5fPYTbmzkHBK2emQtMqks1iGNDgXO3ZjE=",
      timestamp_ms: "1790388956527",
    });
    await withTx((client) => dispatchEvent(freshCtx(client), settleEvent));

    const { rows } = await pg.query("SELECT log_root FROM settlements WHERE link_id = $1", [linkId]);
    expect(Buffer.isBuffer(rows[0].log_root)).toBe(true);
    expect(rows[0].log_root.length).toBe(32);
    expect(rows[0].log_root.toString("base64")).toBe("uH2gmbRXjM5fPYTbmzkHBK2emQtMqks1iGNDgXO3ZjE=");
  });

  it("is idempotent: replaying the exact same PayoutSettled event never double-credits (invariant 1)", async () => {
    const linkId = "link-settle-2";
    await seedLinkWithBatchItem(linkId, "campaign-x", 1002, 0, 1000);

    const settleEvent = ev("PayoutSettled", "payout", "tx-settle-2", 0, {
      link_id: linkId,
      campaign_id: "campaign-x",
      creator: "0xcreator",
      amount: "1000",
      seq: "0",
      seconds_verified: "60",
      log_root: Array(32).fill(2),
      timestamp_ms: "1800000000000",
    });

    await withTx((client) => dispatchEvent(freshCtx(client), settleEvent));
    await withTx((client) => dispatchEvent(freshCtx(client), settleEvent)); // exact replay

    const { rows: linkRows } = await pg.query("SELECT next_seq, total_paid FROM links WHERE link_id = $1", [linkId]);
    expect(Number(linkRows[0].total_paid)).toBe(1000); // not 2000
    expect(Number(linkRows[0].next_seq)).toBe(1); // not 2

    const { rows: accrualRows } = await pg.query("SELECT settled_total FROM accruals WHERE link_id = $1", [linkId]);
    expect(Number(accrualRows[0].settled_total)).toBe(1000);

    const { rows: settlementRows } = await pg.query("SELECT * FROM settlements WHERE link_id = $1", [linkId]);
    expect(settlementRows).toHaveLength(1);
  });

  it("logs a warning but still records the settlement when no matching batch_items row exists", async () => {
    const linkId = "link-settle-3";
    await withTx((client) =>
      dispatchEvent(freshCtx(client), ev("LinkCreated", "link", "seed-3", 0, { link_id: linkId, campaign_id: "campaign-x", creator: "0xc" })),
    );

    const messages: string[] = [];
    const client = await pg.connect();
    try {
      await client.query("BEGIN");
      await dispatchEvent(
        { client, eventSource, log: (msg) => messages.push(msg) },
        ev("PayoutSettled", "payout", "tx-settle-orphan", 0, {
          link_id: linkId,
          campaign_id: "campaign-x",
          creator: "0xcreator",
          amount: "500",
          seq: "0",
          seconds_verified: "60",
          log_root: Array(32).fill(3),
          timestamp_ms: "1800000000000",
        }),
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    expect(messages.some((m) => m.includes("no matching batch_items"))).toBe(true);
    const { rows } = await pg.query("SELECT amount FROM settlements WHERE link_id = $1", [linkId]);
    expect(Number(rows[0].amount)).toBe(500);
  });

  it("does not log the orphan warning when the batch_items row exists but is already confirmed (a benign race with the batcher's own optimistic confirm)", async () => {
    // Observed live: the batcher marks its item confirmed immediately after a
    // successful synchronous submit, before the indexer's own pass over the same
    // event runs. That is expected, not a sign of an outside submitter.
    const linkId = "link-settle-already-confirmed";
    await seedLinkWithBatchItem(linkId, "campaign-x", 1004, 0, 700);
    await pg.query(`UPDATE batch_items SET status = 'confirmed' WHERE link_id = $1`, [linkId]);

    const messages: string[] = [];
    await withTx((client) =>
      dispatchEvent(
        { client, eventSource, log: (msg) => messages.push(msg) },
        ev("PayoutSettled", "payout", "tx-settle-already-confirmed", 0, {
          link_id: linkId,
          campaign_id: "campaign-x",
          creator: "0xcreator",
          amount: "700",
          seq: "0",
          seconds_verified: "60",
          log_root: Array(32).fill(4),
          timestamp_ms: "1800000000000",
        }),
      ),
    );

    expect(messages.some((m) => m.includes("no matching batch_items"))).toBe(false);
    const { rows: itemRows } = await pg.query("SELECT status FROM batch_items WHERE link_id = $1", [linkId]);
    expect(itemRows[0].status).toBe("confirmed"); // unchanged, still correct
    const { rows: linkRows } = await pg.query("SELECT total_paid FROM links WHERE link_id = $1", [linkId]);
    expect(Number(linkRows[0].total_paid)).toBe(700); // the money-moving effects still applied
  });
});

describe("SignerRotated", () => {
  it("logs the rotation without touching any table", async () => {
    const messages: unknown[] = [];
    const client = await pg.connect();
    try {
      await client.query("BEGIN");
      await dispatchEvent({ client, eventSource, log: (msg, meta) => messages.push({ msg, meta }) }, ev("SignerRotated", "oracle_registry", "tx-rotate", 0, { version: "2", pubkey: "abc" }));
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    expect(messages).toHaveLength(1);
  });
});

describe("dispatchEvent", () => {
  it("logs and no-ops for an unknown event type instead of throwing", async () => {
    const messages: string[] = [];
    const client = await pg.connect();
    try {
      await client.query("BEGIN");
      await dispatchEvent({ client, eventSource, log: (msg) => messages.push(msg) }, ev("SomeUnknownEvent", "campaign", "tx-unknown", 0, {}));
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    expect(messages.some((m) => m.includes("no handler"))).toBe(true);
  });
});
