import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { reconcileActiveLinks, reconcileLink, type ChainLinkState, type ChainReader } from "../src/reconciliation.js";
import { createTestDatabase } from "./testHarness.js";

let pg: Pool;

class FakeChainReader implements ChainReader {
  states = new Map<string, ChainLinkState>();
  async getLinkState(linkId: string): Promise<ChainLinkState> {
    const s = this.states.get(linkId);
    if (!s) throw new Error(`no fake chain state for ${linkId}`);
    return s;
  }
}

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_indexer_reconciliation_test");
}, 30_000);

afterAll(async () => {
  await pg.end();
});

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links, accruals, ticks CASCADE");
  await pg.query(
    `INSERT INTO campaigns (campaign_id, seller, coin_type, rate_per_second, max_rate_per_second, per_settle_cap, per_link_epoch_cap, active, open_links)
     VALUES ('campaign-r', '0xseller', '0x2::sui::SUI', 200, 400, 100000, 5000000, true, true)`,
  );
});

async function seedLink(linkId: string, budget: number, nextSeq: number, frozen: boolean, totalPaid: number, settledTotal: number) {
  await pg.query(`INSERT INTO links (link_id, campaign_id, creator, budget_remaining, next_seq, frozen, total_paid) VALUES ($1, 'campaign-r', '0xc', $2, $3, $4, $5)`, [
    linkId,
    budget,
    nextSeq,
    frozen,
    totalPaid,
  ]);
  await pg.query(`INSERT INTO accruals (link_id, earned_total, settled_total) VALUES ($1, $2, $3)`, [linkId, settledTotal, settledTotal]);
}

describe("reconcileLink", () => {
  it("does nothing and reports no mismatch when the mirror already matches the chain", async () => {
    await seedLink("link-match", 1000, 5, false, 500, 500);
    const chain = new FakeChainReader();
    chain.states.set("link-match", { budgetRemaining: 1000, nextSeq: 5, frozen: false, totalPaid: 500 });

    const mismatches = await reconcileLink(pg, chain, "link-match");
    expect(mismatches).toEqual([]);
  });

  it("detects and repairs a budget_remaining mismatch by overwriting the mirror from chain", async () => {
    await seedLink("link-budget", 1000, 5, false, 500, 500);
    const chain = new FakeChainReader();
    chain.states.set("link-budget", { budgetRemaining: 750, nextSeq: 5, frozen: false, totalPaid: 500 });

    const mismatches = await reconcileLink(pg, chain, "link-budget");
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({ field: "budget_remaining", mirrorValue: 1000, chainValue: 750 });

    const { rows } = await pg.query("SELECT budget_remaining FROM links WHERE link_id = $1", ["link-budget"]);
    expect(Number(rows[0].budget_remaining)).toBe(750);
  });

  it("detects and repairs a next_seq mismatch (missed PayoutSettled event)", async () => {
    await seedLink("link-seq", 1000, 2, false, 200, 200);
    const chain = new FakeChainReader();
    chain.states.set("link-seq", { budgetRemaining: 1000, nextSeq: 5, frozen: false, totalPaid: 200 });

    const mismatches = await reconcileLink(pg, chain, "link-seq");
    expect(mismatches.some((m) => m.field === "next_seq")).toBe(true);
    const { rows } = await pg.query("SELECT next_seq FROM links WHERE link_id = $1", ["link-seq"]);
    expect(Number(rows[0].next_seq)).toBe(5);
  });

  it("detects and repairs a frozen mismatch", async () => {
    await seedLink("link-frozen", 1000, 5, false, 500, 500);
    const chain = new FakeChainReader();
    chain.states.set("link-frozen", { budgetRemaining: 1000, nextSeq: 5, frozen: true, totalPaid: 500 });

    const mismatches = await reconcileLink(pg, chain, "link-frozen");
    expect(mismatches.some((m) => m.field === "frozen")).toBe(true);
    const { rows } = await pg.query("SELECT frozen FROM links WHERE link_id = $1", ["link-frozen"]);
    expect(rows[0].frozen).toBe(true);
  });

  it("flags (without silently fixing the accrual) when settled_total disagrees with chain total_paid", async () => {
    await seedLink("link-settled", 1000, 5, false, 900, 500); // mirror settled_total=500, chain total_paid=900
    const chain = new FakeChainReader();
    chain.states.set("link-settled", { budgetRemaining: 1000, nextSeq: 5, frozen: false, totalPaid: 900 });

    const mismatches = await reconcileLink(pg, chain, "link-settled");
    expect(mismatches.some((m) => m.field === "settled_total_vs_chain_total_paid")).toBe(true);
  });

  it("returns no mismatches for a link the mirror doesn't know about", async () => {
    const chain = new FakeChainReader();
    const mismatches = await reconcileLink(pg, chain, "link-does-not-exist");
    expect(mismatches).toEqual([]);
  });
});

describe("reconcileActiveLinks", () => {
  it("only reconciles links with recent tick activity", async () => {
    await seedLink("link-active", 1000, 5, false, 500, 500);
    await seedLink("link-idle", 1000, 5, false, 500, 500);
    await pg.query(
      `INSERT INTO sessions (session_id, link_id, started_at, last_seen_at, ip_hash, ip_class) VALUES ('11111111-1111-1111-1111-111111111111', 'link-active', now(), now(), '\\x00', 'residential')`,
    );
    await pg.query(
      `INSERT INTO ticks (session_id, link_id, seq, received_at, features, score, verdict, weight, amount, scorer_version)
       VALUES ('11111111-1111-1111-1111-111111111111', 'link-active', 1, now(), '{}'::jsonb, 0.9, 'pay', 1.0, 100, '1.0.0')`,
    );

    const chain = new FakeChainReader();
    chain.states.set("link-active", { budgetRemaining: 1, nextSeq: 1, frozen: false, totalPaid: 1 });
    // link-idle deliberately has no fake chain state — if it were queried, the reader would throw.

    const mismatches = await reconcileActiveLinks(pg, chain);
    expect(mismatches.length).toBeGreaterThan(0);
    expect(mismatches.every((m) => m.linkId === "link-active")).toBe(true);
  });
});
