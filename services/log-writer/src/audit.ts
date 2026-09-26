import { bytesToHex, computeLogRoot } from "@kawaipay/shared";
import { fetchPayoutSettledEvent, type OnChainSettlement } from "./chainEvent.js";
import { parseLogFile } from "./logFile.js";
import type { LogStore } from "./logStore.js";

export interface AuditResult {
  ok: boolean;
  linkId: string;
  seq: number;
  onChainRoot: string;
  recomputedRoot: string;
  leafCount: number;
  headerRoot: string;
  headerMatchesOnChain: boolean;
}

/**
 * The public audit procedure (spec section 11): fetch the link's PayoutSettled event to
 * get the on-chain log_root, fetch the corresponding log by its blob ID, recompute the
 * Merkle root from the log's own records, and confirm it equals the on-chain root. Trusts
 * nothing from our own database — the log's header claim (`headerMatchesOnChain`) is
 * checked separately from the actual recomputation, so a doctored header can't fool it.
 */
export async function auditSettlement(opts: {
  graphqlUrl: string;
  network: string;
  txDigest: string;
  linkId: string;
  seq: number;
  blobId: string;
  logStore: LogStore;
  /** Injectable for tests; defaults to a real on-chain GraphQL lookup. */
  fetchEvent?: (graphqlUrl: string, network: string, txDigest: string, linkId: string, seq: number) => Promise<OnChainSettlement | null>;
}): Promise<AuditResult> {
  const fetchEvent = opts.fetchEvent ?? fetchPayoutSettledEvent;
  const event = await fetchEvent(opts.graphqlUrl, opts.network, opts.txDigest, opts.linkId, opts.seq);
  if (!event) {
    throw new Error(`no PayoutSettled event for link ${opts.linkId} seq ${opts.seq} in transaction ${opts.txDigest}`);
  }

  const bytes = await opts.logStore.get(opts.blobId);
  const { header, canonicalRecordJsons } = parseLogFile(bytes);
  const recomputedRoot = computeLogRoot(canonicalRecordJsons);

  const onChainRootHex = bytesToHex(event.logRoot);
  const recomputedRootHex = bytesToHex(recomputedRoot);

  return {
    ok: recomputedRootHex === onChainRootHex,
    linkId: opts.linkId,
    seq: opts.seq,
    onChainRoot: onChainRootHex,
    recomputedRoot: recomputedRootHex,
    leafCount: canonicalRecordJsons.length,
    headerRoot: header.root,
    headerMatchesOnChain: header.root === onChainRootHex,
  };
}
