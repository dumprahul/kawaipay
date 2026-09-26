import { createHash } from "node:crypto";

function sha256(...chunks: Uint8Array[]): Uint8Array {
  const h = createHash("sha256");
  for (const c of chunks) h.update(c);
  return new Uint8Array(h.digest());
}

const LEAF_PREFIX = new Uint8Array([0x00]);
const NODE_PREFIX = new Uint8Array([0x01]);

/** RFC 6962 leaf hash: SHA-256(0x00 || canonicalJson(record)) (spec section 11). */
export function leafHash(canonicalRecordJson: string): Uint8Array {
  return sha256(LEAF_PREFIX, new TextEncoder().encode(canonicalRecordJson));
}

function nodeHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  return sha256(NODE_PREFIX, left, right);
}

/** Largest power of two strictly smaller than n (RFC 6962's split point). */
function largestPowerOfTwoLessThan(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

/**
 * RFC 6962 Merkle Tree Hash over already-computed leaf hashes, in leaf order.
 * MTH(1) = the leaf itself; MTH(n) = node(MTH(first k), MTH(remaining n-k)).
 */
function merkleTreeHash(leaves: Uint8Array[]): Uint8Array {
  if (leaves.length === 0) {
    throw new Error("a batch item always has at least one record (spec section 11)");
  }
  if (leaves.length === 1) {
    return leaves[0]!;
  }
  const k = largestPowerOfTwoLessThan(leaves.length);
  const left = merkleTreeHash(leaves.slice(0, k));
  const right = merkleTreeHash(leaves.slice(k));
  return nodeHash(left, right);
}

/**
 * The log_root for a batch: the Merkle root over its canonical tick records,
 * ordered by (received_at, tick_id) ascending. 32 raw bytes.
 */
export function computeLogRoot(canonicalRecordJsons: string[]): Uint8Array {
  return merkleTreeHash(canonicalRecordJsons.map(leafHash));
}
