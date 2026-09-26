import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeHeartbeatMac, heartbeatMacMessage, sha256Hex, verifyHeartbeatMac } from "../src/mac.js";
import { canonicalJson } from "../src/canonicalJson.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const vector = JSON.parse(readFileSync(join(__dirname, "../testvectors/mac.json"), "utf8"));
const secret = Buffer.from(vector.secretHex, "hex");

describe("heartbeat MAC against the pinned vector", () => {
  it("produces the exact canonical stats JSON (alphabetical keys, no whitespace)", () => {
    expect(canonicalJson(vector.stats)).toBe(vector.canonicalStatsJson);
  });

  it("produces the exact sha256hex(canonicalStats)", () => {
    expect(sha256Hex(vector.canonicalStatsJson)).toBe(vector.statsHash);
  });

  it("builds the exact message string", () => {
    expect(heartbeatMacMessage(vector.sessionId, vector.seq, vector.token, vector.stats)).toBe(vector.message);
  });

  it("produces the exact pinned MAC", () => {
    expect(computeHeartbeatMac(secret, vector.message)).toBe(vector.mac);
  });

  it("verifies correctly end-to-end", () => {
    expect(verifyHeartbeatMac(secret, vector.sessionId, vector.seq, vector.token, vector.stats, vector.mac)).toBe(true);
  });

  it("rejects a tampered stats object", () => {
    const tampered = { ...vector.stats, scrollEvents: vector.stats.scrollEvents + 1 };
    expect(verifyHeartbeatMac(secret, vector.sessionId, vector.seq, vector.token, tampered, vector.mac)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const wrongSecret = Buffer.alloc(32, 0xff);
    expect(verifyHeartbeatMac(wrongSecret, vector.sessionId, vector.seq, vector.token, vector.stats, vector.mac)).toBe(false);
  });
});
