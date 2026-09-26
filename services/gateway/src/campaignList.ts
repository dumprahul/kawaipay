import type { Pool } from "pg";
import type { CampaignListQuery } from "@kawaipay/shared";
import type { CampaignRecord } from "./campaignMetadata.js";

export interface CampaignListPage {
  campaigns: CampaignRecord[];
  nextBeforeCreatedAt: string | null;
}

const MAX_PAGE_SIZE = 100;

/**
 * The shop/search/category browsing surface (spec-adjacent, not from the original spec —
 * added so the frontend has something real to list campaigns from instead of a hardcoded
 * catalog). Only ever returns campaigns that have real metadata set (a seller who never
 * called PUT /v1/campaigns/:id/metadata has nothing worth showing in a storefront yet).
 */
export async function listCampaigns(pg: Pool, query: CampaignListQuery): Promise<CampaignListPage> {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), MAX_PAGE_SIZE);
  const conditions: string[] = ["title IS NOT NULL"];
  const params: unknown[] = [];

  if (query.seller) {
    params.push(query.seller);
    conditions.push(`seller = $${params.length}`);
  }
  if (query.category) {
    params.push(query.category);
    conditions.push(`category = $${params.length}`);
  }
  if (query.beforeCreatedAt) {
    params.push(query.beforeCreatedAt);
    conditions.push(`created_at < $${params.length}`);
  }
  params.push(limit + 1);

  const { rows } = await pg.query(
    `SELECT campaign_id, seller, rate_per_second, active, title, category, description, image_url, price_usd, created_at
     FROM campaigns
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  const page = rows.slice(0, limit);
  const campaigns: CampaignRecord[] = page.map((row) => ({
    campaignId: row.campaign_id,
    seller: row.seller,
    ratePerSecond: Number(row.rate_per_second),
    active: row.active,
    title: row.title,
    category: row.category,
    description: row.description,
    imageUrl: row.image_url,
    priceUsd: row.price_usd === null ? null : Number(row.price_usd),
  }));

  return {
    campaigns,
    nextBeforeCreatedAt: rows.length > limit ? new Date(page[page.length - 1]!.created_at).toISOString() : null,
  };
}
