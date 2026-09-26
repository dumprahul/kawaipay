import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { listCampaignLinks } from "../src/campaignLinks.js";
import { createTestDatabase, seedCampaignAndLink } from "./testHarness.js";

let pg: Pool;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_gw_campaign_links_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links, accruals CASCADE");
});

afterAll(async () => {
  await pg.end();
});

describe("listCampaignLinks", () => {
  it("returns an empty list for a campaign with no links", async () => {
    const { campaignId } = await seedCampaignAndLink(pg, { campaignId: "0x" + "70".repeat(32), linkId: "0x" + "71".repeat(32) });
    await pg.query("DELETE FROM links WHERE campaign_id = $1", [campaignId]);
    expect(await listCampaignLinks(pg, campaignId)).toEqual([]);
  });

  it("returns each link's real budget and accrual state", async () => {
    const { campaignId, linkId } = await seedCampaignAndLink(pg, {
      campaignId: "0x" + "72".repeat(32),
      linkId: "0x" + "73".repeat(32),
      budgetRemaining: 5000,
    });
    await pg.query(`INSERT INTO accruals (link_id, earned_total, settled_total) VALUES ($1, 1200, 800)`, [linkId]);

    const links = await listCampaignLinks(pg, campaignId);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ linkId, frozen: false, budgetRemaining: 5000, earnedTotal: 1200, settledTotal: 800 });
  });

  it("does not include links from a different campaign", async () => {
    const { campaignId: campaignA } = await seedCampaignAndLink(pg, { campaignId: "0x" + "74".repeat(32), linkId: "0x" + "75".repeat(32) });
    await seedCampaignAndLink(pg, { campaignId: "0x" + "76".repeat(32), linkId: "0x" + "77".repeat(32) });

    const links = await listCampaignLinks(pg, campaignA);
    expect(links).toHaveLength(1);
    expect(links[0]!.linkId).toBe("0x" + "75".repeat(32));
  });
});
