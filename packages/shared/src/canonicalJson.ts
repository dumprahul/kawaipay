import { createHash } from "node:crypto";
import type { BucketedStats } from "./types.js";

/** sid: first 16 hex chars of SHA-256(LOG_SECRET, session_id) — a stable per-session pseudonym (spec section 11). */
export function computeSessionPseudonym(sessionId: string, logSecret: string): string {
  return createHash("sha256").update(logSecret).update(sessionId).digest("hex").slice(0, 16);
}

/** Returns a copy of `obj` with keys re-inserted in alphabetical order. */
export function sortKeysAlphabetically<T extends Record<string, unknown>>(obj: T): T {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = (obj as Record<string, unknown>)[key];
  }
  return sorted as T;
}

/**
 * JSON with keys sorted alphabetically, no whitespace (spec section 6's canonicalStats
 * rule, reused wherever the spec says "canonicalJson" generically, e.g. section 12).
 */
export function canonicalJson(obj: Record<string, unknown>): string {
  return JSON.stringify(sortKeysAlphabetically(obj));
}

export interface TickLogRecord {
  v: 1;
  /** First 16 hex chars of SHA-256(LOG_SECRET, session_id): a stable per-session pseudonym. */
  sid: string;
  t: number;
  n: number;
  gap: number;
  ipc: "residential" | "datacenter" | "tor" | "unknown";
  f: BucketedStats;
  sc: number;
  vd: "pay" | "pay_reduced" | "hold" | "reject";
  w: number;
  a: number;
  r: string[];
  sv: string;
}

/**
 * The canonical tick log record (spec section 11): a FIXED top-level key order
 * (v, sid, t, n, gap, ipc, f, sc, vd, w, a, r, sv), with the nested bucketed-stats
 * object's keys sorted alphabetically and reason codes sorted alphabetically.
 * This exact string is what gets hashed into a Merkle leaf.
 */
/** Raw shape of a `ticks` row (joined with its session's ip_class), as read from Postgres. */
export interface TickRow {
  sessionId: string;
  receivedAt: Date;
  seq: number;
  serverGapMs: number | null;
  ipClass: "residential" | "datacenter" | "tor" | "unknown";
  features: BucketedStats;
  score: number;
  verdict: "pay" | "pay_reduced" | "hold" | "reject";
  weight: number;
  amount: number;
  reasons: string[];
  scorerVersion: string;
}

/**
 * Builds a TickLogRecord from a raw ticks-table row (spec section 11). The batcher uses
 * this to build the records it hashes into a batch item's log_root, and the log-writer
 * uses it again to rebuild the same records from persisted ticks — both must produce
 * byte-identical output, so this construction lives in one place only.
 */
export function buildTickLogRecord(row: TickRow, logSecret: string): TickLogRecord {
  return {
    v: 1,
    sid: computeSessionPseudonym(row.sessionId, logSecret),
    t: row.receivedAt.getTime(),
    n: row.seq,
    gap: row.serverGapMs ?? 0,
    ipc: row.ipClass,
    f: row.features,
    sc: Math.round(row.score * 1000),
    vd: row.verdict,
    w: Math.round(row.weight * 10000),
    a: row.amount,
    r: row.reasons,
    sv: row.scorerVersion,
  };
}

export function canonicalTickRecordJson(record: TickLogRecord): string {
  const ordered = {
    v: record.v,
    sid: record.sid,
    t: record.t,
    n: record.n,
    gap: record.gap,
    ipc: record.ipc,
    f: sortKeysAlphabetically(record.f as unknown as Record<string, unknown>),
    sc: record.sc,
    vd: record.vd,
    w: record.w,
    a: record.a,
    r: [...record.r].sort(),
    sv: record.sv,
  };
  return JSON.stringify(ordered);
}
