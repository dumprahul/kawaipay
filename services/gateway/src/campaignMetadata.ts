import type { Pool } from "pg";
import { isValidPersonalMessageSignature } from "@mysten/sui/verify";
import { canonicalJson, type CampaignMetadataRequest } from "@kawaipay/shared";

export interface CampaignRecord {
  campaignId: string;
  seller: string;
  ratePerSecond: number;
  active: boolean;
  category: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
}

function rowToRecord(row: Record<string, unknown>): CampaignRecord {
  return {
    campaignId: row.campaign_id as string,
    seller: row.seller as string,
    ratePerSecond: Number(row.rate_per_second),
    active: row.active as boolean,
    title: (row.title as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    priceUsd: row.price_usd === null || row.price_usd === undefined ? null : Number(row.price_usd),
  };
}

export async function getCampaign(pg: Pool, campaignId: string): Promise<CampaignRecord | null> {
  const { rows } = await pg.query(
    `SELECT campaign_id, seller, rate_per_second, active, title, category, description, image_url, price_usd
     FROM campaigns WHERE campaign_id = $1`,
    [campaignId],
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

/** The exact bytes the seller must sign (as a Sui personal message) to authorize a metadata update. */
export function campaignMetadataSigningMessage(campaignId: string, fields: Omit<CampaignMetadataRequest, "signature">): Uint8Array {
  const json = canonicalJson({
    campaignId,
    title: fields.title,
    category: fields.category,
    description: fields.description,
    imageUrl: fields.imageUrl,
    priceUsd: fields.priceUsd,
  });
  return new TextEncoder().encode(json);
}

export type SetCampaignMetadataOutcome =
  | { kind: "not_found" }
  | { kind: "bad_signature" }
  | { kind: "ok"; campaign: CampaignRecord };

/**
 * Sets a campaign's display-only metadata (title/category/description/image/price) —
 * Postgres only, never the Move contract (none of this affects scoring, payout or
 * trust). Gated by a Sui personal-message signature proving the caller controls
 * `campaigns.seller` for this campaign — verified generically via `@mysten/sui`'s
 * scheme-agnostic verifier, so this works unchanged whether the signer is a plain
 * Ed25519 keypair or a zkLogin address.
 */
export async function setCampaignMetadata(pg: Pool, campaignId: string, body: CampaignMetadataRequest): Promise<SetCampaignMetadataOutcome> {
  const existing = await getCampaign(pg, campaignId);
  if (!existing) return { kind: "not_found" };

  const message = campaignMetadataSigningMessage(campaignId, body);
  const isValid = await isValidPersonalMessageSignature(message, body.signature, { address: existing.seller });
  if (!isValid) return { kind: "bad_signature" };

  await pg.query(`UPDATE campaigns SET title = $2, category = $3, description = $4, image_url = $5, price_usd = $6 WHERE campaign_id = $1`, [
    campaignId,
    body.title,
    body.category,
    body.description,
    body.imageUrl,
    body.priceUsd,
  ]);

  const updated = await getCampaign(pg, campaignId);
  return { kind: "ok", campaign: updated! };
}
