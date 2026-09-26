import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { campaignMetadataSigningMessage, getCampaign, setCampaignMetadata } from "../src/campaignMetadata.js";
import { createTestDatabase, seedCampaignAndLink } from "./testHarness.js";

let pg: Pool;
const sellerKeypair = Ed25519Keypair.generate();
const sellerAddress = sellerKeypair.getPublicKey().toSuiAddress();

const FIELDS = { title: "My Product", category: "media", description: "A great product.", imageUrl: "https://example.com/image.png" };

async function sign(campaignId: string, fields = FIELDS) {
  const message = campaignMetadataSigningMessage(campaignId, fields);
  const { signature } = await sellerKeypair.signPersonalMessage(message);
  return signature;
}

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_gw_campaign_metadata_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links CASCADE");
});

afterAll(async () => {
  await pg.end();
});

describe("getCampaign", () => {
  it("returns null for an unknown campaign", async () => {
    expect(await getCampaign(pg, "no-such-campaign")).toBeNull();
  });

  it("returns the campaign with null metadata before any has been set", async () => {
    const { campaignId } = await seedCampaignAndLink(pg, { campaignId: "campaign-1", seller: sellerAddress });
    const campaign = await getCampaign(pg, campaignId);
    expect(campaign).toMatchObject({ campaignId, seller: sellerAddress, title: null, category: null, description: null, imageUrl: null });
  });
});

describe("setCampaignMetadata", () => {
  it("returns not_found for a campaign that doesn't exist", async () => {
    const signature = await sign("no-such-campaign");
    const outcome = await setCampaignMetadata(pg, "no-such-campaign", { ...FIELDS, signature });
    expect(outcome).toEqual({ kind: "not_found" });
  });

  it("rejects a signature from the wrong keypair", async () => {
    const { campaignId } = await seedCampaignAndLink(pg, { campaignId: "campaign-2", seller: sellerAddress });
    const impostor = Ed25519Keypair.generate();
    const message = campaignMetadataSigningMessage(campaignId, FIELDS);
    const { signature } = await impostor.signPersonalMessage(message);

    const outcome = await setCampaignMetadata(pg, campaignId, { ...FIELDS, signature });
    expect(outcome).toEqual({ kind: "bad_signature" });

    const campaign = await getCampaign(pg, campaignId);
    expect(campaign?.title).toBeNull();
  });

  it("rejects a signature over different content than what's being saved (tamper-proof)", async () => {
    const { campaignId } = await seedCampaignAndLink(pg, { campaignId: "campaign-3", seller: sellerAddress });
    const signature = await sign(campaignId, FIELDS); // signed for the real fields
    const tampered = { ...FIELDS, title: "Something Else", signature }; // but claims a different title

    const outcome = await setCampaignMetadata(pg, campaignId, tampered);
    expect(outcome).toEqual({ kind: "bad_signature" });
  });

  it("sets the metadata when the signature is valid for the real seller and these exact fields", async () => {
    const { campaignId } = await seedCampaignAndLink(pg, { campaignId: "campaign-4", seller: sellerAddress });
    const signature = await sign(campaignId);

    const outcome = await setCampaignMetadata(pg, campaignId, { ...FIELDS, signature });
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") throw new Error("unreachable");
    expect(outcome.campaign).toMatchObject({ campaignId, title: FIELDS.title, category: FIELDS.category, description: FIELDS.description, imageUrl: FIELDS.imageUrl });

    const reread = await getCampaign(pg, campaignId);
    expect(reread).toEqual(outcome.campaign);
  });

  it("lets the real seller update the metadata again later", async () => {
    const { campaignId } = await seedCampaignAndLink(pg, { campaignId: "campaign-5", seller: sellerAddress });
    await setCampaignMetadata(pg, campaignId, { ...FIELDS, signature: await sign(campaignId) });

    const updatedFields = { ...FIELDS, title: "Updated Title" };
    const outcome = await setCampaignMetadata(pg, campaignId, { ...updatedFields, signature: await sign(campaignId, updatedFields) });
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") throw new Error("unreachable");
    expect(outcome.campaign.title).toBe("Updated Title");
  });
});
