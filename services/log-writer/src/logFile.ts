import { bytesToHex } from "@kawaipay/shared";

export interface LogFileHeader {
  v: 1;
  kind: "kawaipay-tick-log";
  link_id: string;
  campaign_id: string;
  seq: number;
  leaf_count: number;
  root: string;
  scorer_version: string;
}

/** Storage key for a batch item's log: one file per (link, on-chain seq) (spec section 11). */
export function logKey(linkId: string, seq: number): string {
  return `logs/${linkId}/${seq}.jsonl`;
}

/**
 * Serializes a batch item's log as UTF-8 JSON Lines: a header line, then one canonical
 * tick record per line, in the same order they were hashed into the root. Deterministic —
 * the same records always produce the same bytes.
 */
export function buildLogFile(
  header: Omit<LogFileHeader, "v" | "kind" | "leaf_count">,
  canonicalRecordJsons: string[],
): Uint8Array {
  const fullHeader: LogFileHeader = {
    v: 1,
    kind: "kawaipay-tick-log",
    link_id: header.link_id,
    campaign_id: header.campaign_id,
    seq: header.seq,
    leaf_count: canonicalRecordJsons.length,
    root: header.root,
    scorer_version: header.scorer_version,
  };
  const lines = [JSON.stringify(fullHeader), ...canonicalRecordJsons];
  return new TextEncoder().encode(lines.join("\n") + "\n");
}

export function headerFor(linkId: string, campaignId: string, seq: number, root: Uint8Array, scorerVersion: string) {
  return { link_id: linkId, campaign_id: campaignId, seq, root: bytesToHex(root), scorer_version: scorerVersion };
}

/** Parses a log file back into its header and canonical record JSON lines (used by the audit CLI). */
export function parseLogFile(bytes: Uint8Array): { header: LogFileHeader; canonicalRecordJsons: string[] } {
  const text = new TextDecoder().decode(bytes);
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) {
    throw new Error("empty log file");
  }
  const header = JSON.parse(lines[0]!) as LogFileHeader;
  return { header, canonicalRecordJsons: lines.slice(1) };
}
