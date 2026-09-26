import type { Pool } from "pg";

export interface LinkSummary {
  linkId: string;
  creator: string;
  frozen: boolean;
  budgetRemaining: number;
  totalPaid: number;
  earnedTotal: number;
  settledTotal: number;
}

/** Every link created against one campaign, with its real accrual state — the owner dashboard's "performance per link" view. */
export async function listCampaignLinks(pg: Pool, campaignId: string): Promise<LinkSummary[]> {
  const { rows } = await pg.query(
    `SELECT l.link_id, l.creator, l.frozen, l.budget_remaining, l.total_paid,
            COALESCE(a.earned_total, 0) AS earned_total, COALESCE(a.settled_total, 0) AS settled_total
     FROM links l
     LEFT JOIN accruals a ON a.link_id = l.link_id
     WHERE l.campaign_id = $1
     ORDER BY l.updated_at DESC`,
    [campaignId],
  );
  return rows.map((row) => ({
    linkId: row.link_id,
    creator: row.creator,
    frozen: row.frozen,
    budgetRemaining: Number(row.budget_remaining),
    totalPaid: Number(row.total_paid),
    earnedTotal: Number(row.earned_total),
    settledTotal: Number(row.settled_total),
  }));
}
