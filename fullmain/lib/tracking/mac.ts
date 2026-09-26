// Vendored from packages/sdk/src/mac.ts (kawaipay backend monorepo) — kept identical so
// it stays byte-for-byte compatible with the gateway's MAC/heartbeat protocol.
//
// Web Crypto only — this file ships to the browser, so node:crypto is not an option.
// The canonicalization rule and message format here MUST match packages/shared/src/mac.ts
// exactly (spec section 6); packages/shared/testvectors/mac.json pins one fixed example
// both sides are tested against.

/**
 * The exact shape sent over the wire (spec section 6) — raw, un-bucketed values.
 * Bucketing happens server-side at the gateway; this MUST match heartbeatRequestSchema's
 * stats shape in packages/shared/src/schemas.ts field-for-field, since both sides compute
 * the MAC over this same object.
 */
export interface HeartbeatStats {
  windowMs: number;
  visibleMs: number;
  focusedMs: number;
  inViewportMs: number;
  contentViewportRatio: number;
  scrollEvents: number;
  scrollDepthPct: number;
  scrollSpeedMax: number;
  pointerMoves: number;
  pointerCells: number;
  touchEvents: number;
  keyEvents: number;
  tabSwitches: number;
}

/** JSON with keys sorted alphabetically, no whitespace (spec section 6's canonicalStats). */
export function canonicalStatsJson(stats: HeartbeatStats): string {
  const sorted: Record<string, number> = {};
  for (const key of Object.keys(stats).sort()) {
    sorted[key] = (stats as unknown as Record<string, number>)[key]!;
  }
  return JSON.stringify(sorted);
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(digest);
}

export async function heartbeatMacMessage(sessionId: string, seq: number, token: string, stats: HeartbeatStats): Promise<string> {
  return `${sessionId}.${seq}.${token}.${await sha256Hex(canonicalStatsJson(stats))}`;
}

/** base64(HMAC-SHA256(key = secret bytes, message)) — the heartbeat MAC itself. */
export async function computeHeartbeatMac(secret: Uint8Array, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secret as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToBase64(signature);
}

export async function signHeartbeat(secret: Uint8Array, sessionId: string, seq: number, token: string, stats: HeartbeatStats): Promise<string> {
  return computeHeartbeatMac(secret, await heartbeatMacMessage(sessionId, seq, token, stats));
}
