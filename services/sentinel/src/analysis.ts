import type { Pool } from "pg";
import type { LinkRiskSignals } from "./rules.js";

/** Every link with at least one tick inside the lookback window — the candidates for evaluation this cycle. */
export async function findActiveLinkIds(pg: Pool, lookbackMs: number, nowMs: number): Promise<string[]> {
  const since = new Date(nowMs - lookbackMs);
  const { rows } = await pg.query(`SELECT DISTINCT link_id FROM ticks WHERE received_at >= $1`, [since]);
  return rows.map((r) => r.link_id as string);
}

/** Gathers one link's fraud-signal inputs from its recent ticks/sessions (spec section 10). */
export async function computeLinkRiskSignals(pg: Pool, linkId: string, lookbackMs: number, nowMs: number): Promise<LinkRiskSignals> {
  const since = new Date(nowMs - lookbackMs);

  const { rows: tickRows } = await pg.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE verdict = 'reject')::int AS reject_count,
            count(*) FILTER (WHERE 'STATS_REPEATING' = ANY(reasons) OR 'GAP_TOO_REGULAR' = ANY(reasons))::int AS bot_count
     FROM ticks
     WHERE link_id = $1 AND received_at >= $2`,
    [linkId, since],
  );
  const totalTicks = tickRows[0].total as number;
  const rejectRate = totalTicks > 0 ? (tickRows[0].reject_count as number) / totalTicks : 0;
  const botSignatureRate = totalTicks > 0 ? (tickRows[0].bot_count as number) / totalTicks : 0;

  const { rows: sourceRows } = await pg.query(
    `SELECT s.ip_hash, count(DISTINCT s.session_id)::int AS n
     FROM sessions s
     JOIN ticks t ON t.session_id = s.session_id
     WHERE t.link_id = $1 AND t.received_at >= $2
     GROUP BY s.ip_hash
     ORDER BY n DESC`,
    [linkId, since],
  );
  const sessionCount = sourceRows.reduce((sum, r) => sum + (r.n as number), 0);
  const dominantSourceRatio = sessionCount > 0 ? (sourceRows[0].n as number) / sessionCount : 0;

  return { linkId, totalTicks, rejectRate, botSignatureRate, sessionCount, dominantSourceRatio };
}
