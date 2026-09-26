import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bytesToHex, hexToBytes } from "@kawaipay/shared";
import { LocalKeySigner } from "../src/signer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// The same seed used to generate packages/shared/testvectors/attestation.json, so this
// doubles as a cross-check that LocalKeySigner reproduces that exact keypair and signature.
const vector = JSON.parse(readFileSync(join(__dirname, "../../shared/testvectors/attestation.json"), "utf8"));

describe("LocalKeySigner", () => {
  it("derives the exact pinned public key from the seed", async () => {
    const signer = new LocalKeySigner(vector.seedHex);
    expect(bytesToHex(await signer.publicKey())).toBe(vector.pubkeyHex);
  });

  it("produces the exact pinned signature for the pinned message (ed25519 is deterministic)", async () => {
    const signer = new LocalKeySigner(vector.seedHex);
    const signature = await signer.sign(hexToBytes(vector.messageHex));
    expect(bytesToHex(signature)).toBe(vector.signatureHex);
  });

  it("rejects a seed that is not 32 bytes", () => {
    expect(() => new LocalKeySigner("aabbcc")).toThrow();
  });

  it("produces different signatures for different messages", async () => {
    const signer = new LocalKeySigner(vector.seedHex);
    const sigA = await signer.sign(new TextEncoder().encode("message A"));
    const sigB = await signer.sign(new TextEncoder().encode("message B"));
    expect(bytesToHex(sigA)).not.toBe(bytesToHex(sigB));
  });
});
