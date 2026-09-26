import type { Pool } from "pg";

export interface CreatorLinkSummary {
  linkId: string;
  campaignId: string;
  title: string | null;
  imageUrl: string | null;
  frozen: boolean;
  budgetRemaining: number;
  totalPaid: number;
  earnedTotal: number;
  settledTotal: number;
}

/** Every link a creator owns, across every campaign — their real "My Links"/payouts/analytics data. */
export async function listLinksByCreator(pg: Pool, creator: string): Promise<CreatorLinkSummary[]> {
  const { rows } = await pg.query(
    `SELECT l.link_id, l.campaign_id, c.title, c.image_url, l.frozen, l.budget_remaining, l.total_paid,
            COALESCE(a.earned_total, 0) AS earned_total, COALESCE(a.settled_total, 0) AS settled_total
     FROM links l
     JOIN campaigns c ON c.campaign_id = l.campaign_id
     LEFT JOIN accruals a ON a.link_id = l.link_id
     WHERE l.creator = $1
     ORDER BY l.updated_at DESC`,
    [creator],
  );
  return rows.map((row) => ({
    linkId: row.link_id,
    campaignId: row.campaign_id,
    title: row.title,
    imageUrl: row.image_url,
    frozen: row.frozen,
    budgetRemaining: Number(row.budget_remaining),
    totalPaid: Number(row.total_paid),
    earnedTotal: Number(row.earned_total),
    settledTotal: Number(row.settled_total),
  }));
}
