import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { computeLinkRiskSignals, findActiveLinkIds } from "../src/analysis.js";
import { createTestDatabase, seedCampaignAndLink, seedTick } from "./testHarness.js";

let pg: Pool;
const NOW = 1_800_000_000_000;
const LOOKBACK_MS = 60 * 60 * 1000;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_sentinel_analysis_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links, sessions, ticks CASCADE");
});

afterAll(async () => {
  await pg.end();
});

describe("findActiveLinkIds", () => {
  it("returns only links with a tick inside the lookback window", async () => {
    const { linkId: recentLink } = await seedCampaignAndLink(pg, "0x" + "01".repeat(32));
    const { linkId: staleLink } = await seedCampaignAndLink(pg, "0x" + "02".repeat(32));
    await seedTick(pg, recentLink, "10000000-0000-0000-0000-000000000000", "aa", 0, new Date(NOW - 1000));
    await seedTick(pg, staleLink, "20000000-0000-0000-0000-000000000000", "bb", 0, new Date(NOW - LOOKBACK_MS - 10_000));

    const active = await findActiveLinkIds(pg, LOOKBACK_MS, NOW);
    expect(active).toEqual([recentLink]);
  });
});

describe("computeLinkRiskSignals", () => {
  it("computes reject rate and bot-signature rate from recent ticks", async () => {
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "03".repeat(32));
    for (let i = 0; i < 6; i++) {
      await seedTick(pg, linkId, `30000000-0000-0000-0000-00000000000${i}`, "aa", i, new Date(NOW - 1000), {
        verdict: i < 3 ? "reject" : "pay",
        reasons: i < 2 ? ["STATS_REPEATING"] : [],
      });
    }
    const signals = await computeLinkRiskSignals(pg, linkId, LOOKBACK_MS, NOW);
    expect(signals.totalTicks).toBe(6);
    expect(signals.rejectRate).toBeCloseTo(3 / 6);
    expect(signals.botSignatureRate).toBeCloseTo(2 / 6);
  });

  it("computes source concentration from distinct sessions' ip_hash", async () => {
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "04".repeat(32));
    // 4 sessions from ip_hash 'aa', 1 from 'bb'.
    for (let i = 0; i < 4; i++) {
      await seedTick(pg, linkId, `40000000-0000-0000-0000-00000000000${i}`, "aa", 0, new Date(NOW - 1000));
    }
    await seedTick(pg, linkId, "40000000-0000-0000-0000-000000000009", "bb", 0, new Date(NOW - 1000));

    const signals = await computeLinkRiskSignals(pg, linkId, LOOKBACK_MS, NOW);
    expect(signals.sessionCount).toBe(5);
    expect(signals.dominantSourceRatio).toBeCloseTo(4 / 5);
  });

  it("returns zeros for a link with no recent activity", async () => {
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "05".repeat(32));
    const signals = await computeLinkRiskSignals(pg, linkId, LOOKBACK_MS, NOW);
    expect(signals).toEqual({ linkId, totalTicks: 0, rejectRate: 0, botSignatureRate: 0, sessionCount: 0, dominantSourceRatio: 0 });
  });

  it("ignores ticks outside the lookback window", async () => {
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "06".repeat(32));
    await seedTick(pg, linkId, "60000000-0000-0000-0000-000000000000", "aa", 0, new Date(NOW - LOOKBACK_MS - 10_000), { verdict: "reject" });
    const signals = await computeLinkRiskSignals(pg, linkId, LOOKBACK_MS, NOW);
    expect(signals.totalTicks).toBe(0);
  });
});
