import type { Pool } from "pg";
import { isValidPersonalMessageSignature } from "@mysten/sui/verify";
import { canonicalJson, type CampaignMetadataRequest } from "@kawaipay/shared";

export interface CampaignRecord {
  campaignId: string;
  seller: string;
  ratePerSecond: number;
  active: boolean;
  title: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
}

export async function getCampaign(pg: Pool, campaignId: string): Promise<CampaignRecord | null> {
  const { rows } = await pg.query(
    `SELECT campaign_id, seller, rate_per_second, active, title, category, description, image_url
     FROM campaigns WHERE campaign_id = $1`,
    [campaignId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    campaignId: row.campaign_id,
    seller: row.seller,
    ratePerSecond: Number(row.rate_per_second),
    active: row.active,
    title: row.title,
    category: row.category,
    description: row.description,
    imageUrl: row.image_url,
  };
}

/** The exact bytes the seller must sign (as a Sui personal message) to authorize a metadata update. */
export function campaignMetadataSigningMessage(campaignId: string, fields: Omit<CampaignMetadataRequest, "signature">): Uint8Array {
  const json = canonicalJson({
    campaignId,
    title: fields.title,
    category: fields.category,
    description: fields.description,
    imageUrl: fields.imageUrl,
  });
  return new TextEncoder().encode(json);
}

export type SetCampaignMetadataOutcome =
  | { kind: "not_found" }
  | { kind: "bad_signature" }
  | { kind: "ok"; campaign: CampaignRecord };

/**
 * Sets a campaign's display-only metadata (title/category/description/image) — Postgres
 * only, never the Move contract (none of this affects scoring, payout or trust). Gated by
 * a Sui personal-message signature proving the caller controls `campaigns.seller` for
 * this campaign, so only the real on-chain creator can set their own campaign's listing.
 */
export async function setCampaignMetadata(pg: Pool, campaignId: string, body: CampaignMetadataRequest): Promise<SetCampaignMetadataOutcome> {
  const existing = await getCampaign(pg, campaignId);
  if (!existing) return { kind: "not_found" };

  const message = campaignMetadataSigningMessage(campaignId, body);
  const isValid = await isValidPersonalMessageSignature(message, body.signature, { address: existing.seller });
  if (!isValid) return { kind: "bad_signature" };

  await pg.query(`UPDATE campaigns SET title = $2, category = $3, description = $4, image_url = $5 WHERE campaign_id = $1`, [
    campaignId,
    body.title,
    body.category,
    body.description,
    body.imageUrl,
  ]);

  const updated = await getCampaign(pg, campaignId);
  return { kind: "ok", campaign: updated! };
}
