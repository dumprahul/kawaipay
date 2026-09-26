import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { partitionByWorldIdEligibility } from "../src/worldIdGate.js";
import type { CandidateLink } from "../src/selection.js";
import { createTestDatabase } from "./testHarness.js";

let pg: Pool;

const CONFIG = { freePayouts: 2, validityDays: 7 };

function link(overrides: Partial<CandidateLink> = {}): CandidateLink {
  return {
    linkId: "0x" + "aa".repeat(32),
    campaignId: "0x" + "bb".repeat(32),
    creator: "0x" + "cc".repeat(32),
    budgetRemaining: 1_000_000,
    nextSeq: 0,
    maxRatePerSecond: 1000,
    perSettleCap: 1_000_000,
    ...overrides,
  };
}

async function seedLinkRow(pg: Pool, linkId: string, campaignId: string, creator: string) {
  await pg.query(
    `INSERT INTO campaigns (campaign_id, seller, coin_type, rate_per_second, max_rate_per_second, per_settle_cap, per_link_epoch_cap, active, open_links)
     VALUES ($1, '0xseller', '0x2::sui::SUI', 200, 1000, 1000000, 5000000, true, true)
     ON CONFLICT DO NOTHING`,
    [campaignId],
  );
  await pg.query(
    `INSERT INTO links (link_id, campaign_id, creator, budget_remaining, next_seq) VALUES ($1, $2, $3, 1000000, 0)
     ON CONFLICT DO NOTHING`,
    [linkId, campaignId, creator],
  );
}

async function seedSettlements(pg: Pool, linkId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await pg.query(
      `INSERT INTO settlements (tx_digest, event_seq, link_id, seq, amount, seconds_verified, log_root, checkpoint, ts)
       VALUES ($1, $2, $3, $4, 1000, 5, decode('aa', 'hex'), 1, now())`,
      [`digest-${linkId}-${i}`, i, linkId, i],
    );
  }
}

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_batcher_worldid_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE settlements, verified_creators, links, campaigns CASCADE");
});

afterAll(async () => {
  await pg.end();
});

describe("partitionByWorldIdEligibility", () => {
  it("lets a fresh creator through with zero settlements", async () => {
    const l = link();
    await seedLinkRow(pg, l.linkId, l.campaignId, l.creator);

    const result = await partitionByWorldIdEligibility(pg, [l], CONFIG);
    expect(result.eligible).toEqual([l]);
    expect(result.blocked).toEqual([]);
  });

  it("still lets a creator through on their (freePayouts - 1)th settlement", async () => {
    const l = link();
    await seedLinkRow(pg, l.linkId, l.campaignId, l.creator);
    await seedSettlements(pg, l.linkId, 1); // 1 < freePayouts(2)

    const result = await partitionByWorldIdEligibility(pg, [l], CONFIG);
    expect(result.eligible).toEqual([l]);
  });

  it("blocks with WORLD_ID_REQUIRED once free payouts are used and no verification exists", async () => {
    const l = link();
    await seedLinkRow(pg, l.linkId, l.campaignId, l.creator);
    await seedSettlements(pg, l.linkId, 2); // == freePayouts

    const result = await partitionByWorldIdEligibility(pg, [l], CONFIG);
    expect(result.eligible).toEqual([]);
    expect(result.blocked).toEqual([{ linkId: l.linkId, creator: l.creator, reason: "WORLD_ID_REQUIRED", payoutCount: 2 }]);
  });

  it("lets a creator through once verified within the validity window", async () => {
    const l = link();
    await seedLinkRow(pg, l.linkId, l.campaignId, l.creator);
    await seedSettlements(pg, l.linkId, 2);
    await pg.query(`INSERT INTO verified_creators (sui_address, nullifier_hash, verified_at) VALUES ($1, 'null-1', now())`, [l.creator]);

    const result = await partitionByWorldIdEligibility(pg, [l], CONFIG);
    expect(result.eligible).toEqual([l]);
    expect(result.blocked).toEqual([]);
  });

  it("blocks with WORLD_ID_EXPIRED once the verification is older than the validity window", async () => {
    const l = link();
    await seedLinkRow(pg, l.linkId, l.campaignId, l.creator);
    await seedSettlements(pg, l.linkId, 2);
    await pg.query(
      `INSERT INTO verified_creators (sui_address, nullifier_hash, verified_at) VALUES ($1, 'null-1', now() - interval '8 days')`,
      [l.creator],
    );

    const result = await partitionByWorldIdEligibility(pg, [l], CONFIG);
    expect(result.eligible).toEqual([]);
    expect(result.blocked).toEqual([{ linkId: l.linkId, creator: l.creator, reason: "WORLD_ID_EXPIRED", payoutCount: 2 }]);
  });

  it("handles multiple links across different creators independently", async () => {
    const fresh = link({ linkId: "0x" + "11".repeat(32), campaignId: "0x" + "22".repeat(32), creator: "0x" + "33".repeat(32) });
    const blocked = link({ linkId: "0x" + "44".repeat(32), campaignId: "0x" + "55".repeat(32), creator: "0x" + "66".repeat(32) });
    await seedLinkRow(pg, fresh.linkId, fresh.campaignId, fresh.creator);
    await seedLinkRow(pg, blocked.linkId, blocked.campaignId, blocked.creator);
    await seedSettlements(pg, blocked.linkId, 5);

    const result = await partitionByWorldIdEligibility(pg, [fresh, blocked], CONFIG);
    expect(result.eligible).toEqual([fresh]);
    expect(result.blocked.map((b) => b.linkId)).toEqual([blocked.linkId]);
  });
});
