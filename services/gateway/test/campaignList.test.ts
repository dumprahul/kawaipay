import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { listCampaigns } from "../src/campaignList.js";
import { setCampaignMetadata } from "../src/campaignMetadata.js";
import { createTestDatabase, seedCampaignAndLink } from "./testHarness.js";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { campaignMetadataSigningMessage } from "../src/campaignMetadata.js";

let pg: Pool;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_gw_campaign_list_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links CASCADE");
});

afterAll(async () => {
  await pg.end();
});

async function seedListedCampaign(campaignId: string, opts: { seller?: string; category?: string; title?: string } = {}) {
  const keypair = Ed25519Keypair.generate();
  const seller = opts.seller ?? keypair.getPublicKey().toSuiAddress();
  await seedCampaignAndLink(pg, { campaignId, linkId: "0x" + campaignId.slice(2, 4).repeat(32), seller });
  const fields = { title: opts.title ?? "Product", category: opts.category ?? "tools", description: "desc", imageUrl: "https://example.com/x.png", priceUsd: 10 };
  const { signature } = await keypair.signPersonalMessage(campaignMetadataSigningMessage(campaignId, fields));
  const outcome = await setCampaignMetadata(pg, campaignId, { ...fields, signature });
  if (outcome.kind !== "ok") throw new Error(`seeding failed: ${outcome.kind}`);
  return { seller, campaignId };
}

describe("listCampaigns", () => {
  it("excludes campaigns with no metadata set (nothing worth showing yet)", async () => {
    await seedCampaignAndLink(pg, { campaignId: "0x" + "60".repeat(32), linkId: "0x" + "61".repeat(32) });
    const page = await listCampaigns(pg, {});
    expect(page.campaigns).toHaveLength(0);
  });

  it("lists campaigns that have metadata, newest first", async () => {
    await seedListedCampaign("0x" + "62".repeat(32), { title: "First" });
    await new Promise((r) => setTimeout(r, 10));
    await seedListedCampaign("0x" + "63".repeat(32), { title: "Second" });

    const page = await listCampaigns(pg, {});
    expect(page.campaigns.map((c) => c.title)).toEqual(["Second", "First"]);
  });

  it("filters by seller", async () => {
    const { seller } = await seedListedCampaign("0x" + "64".repeat(32));
    await seedListedCampaign("0x" + "65".repeat(32));

    const page = await listCampaigns(pg, { seller });
    expect(page.campaigns).toHaveLength(1);
    expect(page.campaigns[0]!.seller).toBe(seller);
  });

  it("filters by category", async () => {
    await seedListedCampaign("0x" + "66".repeat(32), { category: "beauty" });
    await seedListedCampaign("0x" + "67".repeat(32), { category: "electronics" });

    const page = await listCampaigns(pg, { category: "beauty" });
    expect(page.campaigns).toHaveLength(1);
    expect(page.campaigns[0]!.category).toBe("beauty");
  });

  it("paginates with limit + beforeCreatedAt", async () => {
    for (const suffix of ["68", "69", "6a", "6b", "6c"]) {
      await seedListedCampaign("0x" + suffix.repeat(32));
      await new Promise((r) => setTimeout(r, 10));
    }
    const first = await listCampaigns(pg, { limit: 2 });
    expect(first.campaigns).toHaveLength(2);
    expect(first.nextBeforeCreatedAt).not.toBeNull();

    const second = await listCampaigns(pg, { limit: 2, beforeCreatedAt: first.nextBeforeCreatedAt! });
    expect(second.campaigns).toHaveLength(2);
    expect(second.campaigns[0]!.campaignId).not.toBe(first.campaigns[0]!.campaignId);
  });
});
