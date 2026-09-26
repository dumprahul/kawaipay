import type { Pool } from "pg";
import type { IpClass } from "@kawaipay/shared";

/** The joined view of a link's mirror state the gateway and scorer both need. */
export interface LinkMirror {
  linkId: string;
  campaignId: string;
  creator: string;
  frozen: boolean;
  budgetRemaining: number;
  nextSeq: number;
  ratePerSecond: number;
  campaignActive: boolean;
  weightMultiplier: number;
  hold: boolean;
}

export async function getLinkMirror(pg: Pool, linkId: string): Promise<LinkMirror | null> {
  const { rows } = await pg.query(
    `SELECT l.link_id, l.campaign_id, l.creator, l.frozen, l.budget_remaining, l.next_seq,
            c.rate_per_second, c.active AS campaign_active,
            COALESCE(r.weight_multiplier, 1.0) AS weight_multiplier,
            COALESCE(r.hold, false) AS hold
     FROM links l
     JOIN campaigns c ON c.campaign_id = l.campaign_id
     LEFT JOIN link_risk r ON r.link_id = l.link_id
     WHERE l.link_id = $1`,
    [linkId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    linkId: row.link_id,
    campaignId: row.campaign_id,
    creator: row.creator,
    frozen: row.frozen,
    budgetRemaining: Number(row.budget_remaining),
    nextSeq: Number(row.next_seq),
    ratePerSecond: Number(row.rate_per_second),
    campaignActive: row.campaign_active,
    weightMultiplier: Number(row.weight_multiplier),
    hold: row.hold,
  };
}

/** Whether a link is currently payable: exists, this package's Link type (implicit via mirror row),
 * not frozen, campaign active, and budget above the configured minimum (spec section 5). */
export function isLinkPayable(link: LinkMirror, minLinkBudget: number): boolean {
  return !link.frozen && link.campaignActive && link.budgetRemaining >= minLinkBudget;
}

export interface HistoryTickRow {
  gapMs: number;
  score: number;
  features: unknown;
}

/** The session's previous ticks, oldest first, up to 12 (spec section 7 scoring inputs). */
export async function getRecentTicks(pg: Pool, sessionId: string, limit = 12): Promise<HistoryTickRow[]> {
  const { rows } = await pg.query(
    `SELECT server_gap_ms, score, features FROM ticks WHERE session_id = $1 ORDER BY seq DESC LIMIT $2`,
    [sessionId, limit],
  );
  return rows
    .map((r) => ({ gapMs: Number(r.server_gap_ms), score: Number(r.score), features: r.features }))
    .reverse();
}

/** ms of the link's first-ever tick, or null if this would be its first (drives warm-up). */
export async function getLinkFirstTickMs(pg: Pool, linkId: string): Promise<number | null> {
  const { rows } = await pg.query(`SELECT MIN(received_at) AS first_tick FROM ticks WHERE link_id = $1`, [linkId]);
  const value = rows[0]?.first_tick;
  return value ? new Date(value).getTime() : null;
}

export function classifyIp(_ip: string): IpClass {
  // Placeholder: real datacenter/Tor classification needs a licensed IP intelligence
  // source (spec section 16, open question Q1). Until that's wired in, everything is
  // treated as "unknown", which the scorer does not penalize (only datacenter/tor are).
  return "unknown";
}
