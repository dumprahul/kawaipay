import { createHash, createHmac } from "node:crypto";
import { canonicalJson } from "./canonicalJson.js";

/** SHA-256 hex digest of a canonical JSON string (spec section 6's sha256hex(canonicalStats)). */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Builds the message a heartbeat's MAC is computed over (spec section 6):
 * `sessionId.seq.token.sha256hex(canonicalStats)`.
 */
export function heartbeatMacMessage(
  sessionId: string,
  seq: number,
  token: string,
  stats: Record<string, unknown>,
): string {
  return `${sessionId}.${seq}.${token}.${sha256Hex(canonicalJson(stats))}`;
}

/** base64(HMAC-SHA256(key = secret bytes, message)) — the heartbeat MAC itself. */
export function computeHeartbeatMac(secret: Uint8Array, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("base64");
}

/** Convenience: builds the message and signs it in one call. */
export function signHeartbeat(
  secret: Uint8Array,
  sessionId: string,
  seq: number,
  token: string,
  stats: Record<string, unknown>,
): string {
  return computeHeartbeatMac(secret, heartbeatMacMessage(sessionId, seq, token, stats));
}

/** Constant-time-ish comparison is not needed here: HMAC verification is a re-derive-and-compare. */
export function verifyHeartbeatMac(
  secret: Uint8Array,
  sessionId: string,
  seq: number,
  token: string,
  stats: Record<string, unknown>,
  mac: string,
): boolean {
  return signHeartbeat(secret, sessionId, seq, token, stats) === mac;
}
