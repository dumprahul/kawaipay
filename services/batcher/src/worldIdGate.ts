import type { Pool } from "pg";
import type { CandidateLink } from "./selection.js";

export interface WorldIdGateConfig {
  freePayouts: number;
  validityDays: number;
}

export interface BlockedLink {
  linkId: string;
  creator: string;
  reason: "WORLD_ID_REQUIRED" | "WORLD_ID_EXPIRED";
  payoutCount: number;
}

export interface WorldIdGateResult {
  eligible: CandidateLink[];
  blocked: BlockedLink[];
}

/**
 * A creator's first `freePayouts` settlements (across every link they own, not per-link)
 * need no verification at all — real payouts flow immediately for a new creator. Every
 * payout after that requires a `verified_creators` row for their address with
 * `verified_at` within the last `validityDays`; otherwise the link is held out of this
 * batch (not failed — it stays eligible for a later cycle once they verify) rather than
 * dropped, since selectEligibleLinks will just pick it up again next time.
 */
export async function partitionByWorldIdEligibility(
  pg: Pool,
  links: CandidateLink[],
  config: WorldIdGateConfig,
): Promise<WorldIdGateResult> {
  if (links.length === 0) return { eligible: [], blocked: [] };

  const creators = [...new Set(links.map((l) => l.creator))];

  const [{ rows: payoutRows }, { rows: verifiedRows }] = await Promise.all([
    pg.query(
      `SELECT l.creator, COUNT(*)::int AS payout_count
       FROM settlements s JOIN links l ON l.link_id = s.link_id
       WHERE l.creator = ANY($1)
       GROUP BY l.creator`,
      [creators],
    ),
    pg.query(
      `SELECT sui_address, (verified_at + interval '${config.validityDays} days' > now()) AS still_valid
       FROM verified_creators WHERE sui_address = ANY($1)`,
      [creators],
    ),
  ]);

  const payoutCounts = new Map<string, number>(payoutRows.map((r) => [r.creator, r.payout_count]));
  const verified = new Map<string, boolean>(verifiedRows.map((r) => [r.sui_address, r.still_valid === true]));

  const eligible: CandidateLink[] = [];
  const blocked: BlockedLink[] = [];

  for (const link of links) {
    const payoutCount = payoutCounts.get(link.creator) ?? 0;
    if (payoutCount < config.freePayouts) {
      eligible.push(link);
      continue;
    }
    if (verified.get(link.creator) === true) {
      eligible.push(link);
      continue;
    }
    blocked.push({
      linkId: link.linkId,
      creator: link.creator,
      reason: verified.has(link.creator) ? "WORLD_ID_EXPIRED" : "WORLD_ID_REQUIRED",
      payoutCount,
    });
  }

  return { eligible, blocked };
}
