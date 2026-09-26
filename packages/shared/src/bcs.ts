import type { Attestation } from "./types.js";
import { PAYOUT_DOMAIN } from "./constants.js";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = clean.length % 2 === 0 ? clean : "0" + clean;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** A Sui object ID is a 32-byte address; BCS serializes it as exactly those 32 raw bytes. */
function encodeObjectId(id: string): Uint8Array {
  const bytes = hexToBytes(id);
  if (bytes.length !== 32) {
    throw new Error(`object id must be 32 bytes, got ${bytes.length}: ${id}`);
  }
  return bytes;
}

function encodeU64LE(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`u64 field must be a non-negative integer, got ${n}`);
  }
  const out = new Uint8Array(8);
  let v = BigInt(n);
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function encodeUleb128(n: number): Uint8Array {
  const bytes: number[] = [];
  let v = n;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (v !== 0);
  return new Uint8Array(bytes);
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * BCS-encodes the on-chain Attestation struct (payout.move), field order matching the
 * struct declaration exactly: campaign_id, link_id, seq, seconds_verified, amount,
 * log_root (ULEB128 length + bytes), expires_at_ms. See spec section 3.
 */
export function encodeAttestation(att: Attestation): Uint8Array {
  if (att.logRoot.length !== 32) {
    throw new Error(`log_root must be 32 bytes, got ${att.logRoot.length}`);
  }
  return concatBytes(
    encodeObjectId(att.campaignId),
    encodeObjectId(att.linkId),
    encodeU64LE(att.seq),
    encodeU64LE(att.secondsVerified),
    encodeU64LE(att.amount),
    encodeUleb128(att.logRoot.length),
    att.logRoot,
    encodeU64LE(att.expiresAtMs),
  );
}

/** The exact bytes payout::settle verifies the signature over: DOMAIN || bcs(Attestation). */
export function encodePayoutMessage(att: Attestation): Uint8Array {
  const domain = new TextEncoder().encode(PAYOUT_DOMAIN);
  return concatBytes(domain, encodeAttestation(att));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export { hexToBytes };
