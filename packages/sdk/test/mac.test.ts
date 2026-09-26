import { describe, expect, it } from "vitest";
import * as shared from "@kawaipay/shared";
import { canonicalStatsJson, computeHeartbeatMac, heartbeatMacMessage, sha256Hex, signHeartbeat, type HeartbeatStats } from "../src/mac.js";

const STATS: HeartbeatStats = {
  windowMs: 5000,
  visibleMs: 5000,
  focusedMs: 5000,
  inViewportMs: 5000,
  contentViewportRatio: 0.8,
  scrollEvents: 5,
  scrollDepthPct: 40,
  scrollSpeedMax: 500,
  pointerMoves: 10,
  pointerCells: 6,
  touchEvents: 0,
  keyEvents: 0,
  tabSwitches: 0,
};
const SECRET = new Uint8Array(32).map((_, i) => i);
const SESSION_ID = "6f9619ff-8b86-d011-b42d-00cf4fc964ff";
const SEQ = 7;
const TOKEN = "opaque-token-abc123";

describe("canonicalStatsJson", () => {
  it("sorts keys alphabetically with no whitespace", () => {
    const json = canonicalStatsJson(STATS);
    expect(json).toBe(canonicalJsonReference(STATS));
    expect(json).not.toMatch(/\s/);
  });

  function canonicalJsonReference(stats: HeartbeatStats): string {
    // Independent re-implementation for the assertion above, not imported from src/.
    const sorted: Record<string, number> = {};
    for (const key of Object.keys(stats).sort()) sorted[key] = (stats as unknown as Record<string, number>)[key]!;
    return JSON.stringify(sorted);
  }
});

describe("SDK mac.ts against @kawaipay/shared's Node implementation (real interop, not a static fixture)", () => {
  it("produces byte-identical canonical JSON to the server's canonicalJson()", () => {
    expect(canonicalStatsJson(STATS)).toBe(shared.canonicalJson(STATS as unknown as Record<string, unknown>));
  });

  it("produces the identical sha256hex to the server's sha256Hex()", async () => {
    const canonical = canonicalStatsJson(STATS);
    expect(await sha256Hex(canonical)).toBe(shared.sha256Hex(canonical));
  });

  it("produces the identical message string to the server's heartbeatMacMessage()", async () => {
    const sdkMessage = await heartbeatMacMessage(SESSION_ID, SEQ, TOKEN, STATS);
    const serverMessage = shared.heartbeatMacMessage(SESSION_ID, SEQ, TOKEN, STATS as unknown as Record<string, unknown>);
    expect(sdkMessage).toBe(serverMessage);
  });

  it("produces the identical MAC as the server would compute for the same inputs", async () => {
    const sdkMac = await computeHeartbeatMac(SECRET, await heartbeatMacMessage(SESSION_ID, SEQ, TOKEN, STATS));
    const serverMac = shared.computeHeartbeatMac(Buffer.from(SECRET), shared.heartbeatMacMessage(SESSION_ID, SEQ, TOKEN, STATS as unknown as Record<string, unknown>));
    expect(sdkMac).toBe(serverMac);
  });

  it("a MAC signed by the SDK verifies successfully against the server's verifyHeartbeatMac()", async () => {
    const mac = await signHeartbeat(SECRET, SESSION_ID, SEQ, TOKEN, STATS);
    const verified = shared.verifyHeartbeatMac(Buffer.from(SECRET), SESSION_ID, SEQ, TOKEN, STATS as unknown as Record<string, unknown>, mac);
    expect(verified).toBe(true);
  });

  it("tampering with a stat after signing breaks server-side verification", async () => {
    const mac = await signHeartbeat(SECRET, SESSION_ID, SEQ, TOKEN, STATS);
    const tampered = { ...STATS, scrollEvents: STATS.scrollEvents + 1 };
    const verified = shared.verifyHeartbeatMac(Buffer.from(SECRET), SESSION_ID, SEQ, TOKEN, tampered as unknown as Record<string, unknown>, mac);
    expect(verified).toBe(false);
  });
});
