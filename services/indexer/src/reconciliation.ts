import type { Pool } from "pg";

export interface ChainLinkState {
  budgetRemaining: number;
  nextSeq: number;
  frozen: boolean;
  totalPaid: number;
}

/** Reads a Link's current on-chain fields. Kept behind an interface for the same reason as EventSource. */
export interface ChainReader {
  getLinkState(linkId: string): Promise<ChainLinkState>;
}

export interface Mismatch {
  linkId: string;
  field: string;
  mirrorValue: unknown;
  chainValue: unknown;
}

type Logger = (msg: string, meta?: Record<string, unknown>) => void;

/**
 * Compares one link's mirror against the chain and repairs any mismatch by overwriting
 * the mirror (spec section 9, reconciliation steps 1-3). Mismatches mean an event was
 * missed or a handler is wrong — always logged and always treated as an alert-worthy
 * condition by the caller, never silently ignored.
 */
export async function reconcileLink(pg: Pool, chain: ChainReader, linkId: string, log: Logger = () => {}): Promise<Mismatch[]> {
  const { rows } = await pg.query(`SELECT budget_remaining, next_seq, frozen, total_paid FROM links WHERE link_id = $1`, [linkId]);
  const mirror = rows[0];
  if (!mirror) return [];

  const chainState = await chain.getLinkState(linkId);
  const mismatches: Mismatch[] = [];

  if (Number(mirror.budget_remaining) !== chainState.budgetRemaining) {
    mismatches.push({ linkId, field: "budget_remaining", mirrorValue: Number(mirror.budget_remaining), chainValue: chainState.budgetRemaining });
  }
  if (Number(mirror.next_seq) !== chainState.nextSeq) {
    mismatches.push({ linkId, field: "next_seq", mirrorValue: Number(mirror.next_seq), chainValue: chainState.nextSeq });
  }
  if (mirror.frozen !== chainState.frozen) {
    mismatches.push({ linkId, field: "frozen", mirrorValue: mirror.frozen, chainValue: chainState.frozen });
  }

  if (mismatches.length > 0) {
    await pg.query(`UPDATE links SET budget_remaining = $2, next_seq = $3, frozen = $4 WHERE link_id = $1`, [
      linkId,
      chainState.budgetRemaining,
      chainState.nextSeq,
      chainState.frozen,
    ]);
    log("reconciliation: mirror mismatch repaired from chain", { linkId, mismatches });
  }

  const { rows: accrualRows } = await pg.query(`SELECT settled_total FROM accruals WHERE link_id = $1`, [linkId]);
  if (accrualRows[0] && Number(accrualRows[0].settled_total) !== chainState.totalPaid) {
    const mismatch: Mismatch = {
      linkId,
      field: "settled_total_vs_chain_total_paid",
      mirrorValue: Number(accrualRows[0].settled_total),
      chainValue: chainState.totalPaid,
    };
    mismatches.push(mismatch);
    log("reconciliation: accruals.settled_total disagrees with chain total_paid", { ...mismatch });
  }

  return mismatches;
}

/** Reconciles every link with activity in the last N hours (default 24, per spec section 9). */
export async function reconcileActiveLinks(pg: Pool, chain: ChainReader, log: Logger = () => {}, activeSinceHours = 24): Promise<Mismatch[]> {
  const { rows } = await pg.query(
    `SELECT DISTINCT link_id FROM ticks WHERE received_at > now() - ($1 * interval '1 hour')`,
    [activeSinceHours],
  );
  const all: Mismatch[] = [];
  for (const row of rows) {
    all.push(...(await reconcileLink(pg, chain, row.link_id, log)));
  }
  return all;
}
