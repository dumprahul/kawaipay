import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bytesToHex, encodeAttestation, encodePayoutMessage, hexToBytes } from "../src/bcs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const vector = JSON.parse(readFileSync(join(__dirname, "../testvectors/attestation.json"), "utf8"));

describe("encodeAttestation / encodePayoutMessage against the shared cross-language vector", () => {
  const att = {
    campaignId: vector.campaignIdHex,
    linkId: vector.linkIdHex,
    seq: vector.seq,
    secondsVerified: vector.secondsVerified,
    amount: vector.amount,
    logRoot: hexToBytes(vector.logRootHex),
    expiresAtMs: vector.expiresAtMs,
  };

  it("produces the exact pinned BCS bytes", () => {
    expect(bytesToHex(encodeAttestation(att))).toBe(vector.bcsBytesHex);
  });

  it("produces the exact pinned DOMAIN || bcs(Attestation) message", () => {
    expect(bytesToHex(encodePayoutMessage(att))).toBe(vector.messageHex);
  });

  it("rejects a campaign_id that is not 32 bytes", () => {
    expect(() => encodeAttestation({ ...att, campaignId: "0x1234" })).toThrow();
  });

  it("rejects a log_root that is not 32 bytes", () => {
    expect(() => encodeAttestation({ ...att, logRoot: new Uint8Array(10) })).toThrow();
  });
});
