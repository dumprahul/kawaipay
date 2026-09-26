import { createPrivateKey, createPublicKey, sign as edSign } from "node:crypto";
import { hexToBytes } from "@kawaipay/shared";

/**
 * The only place the Oracle's private key is touched. Implementations: LocalKeySigner
 * (this file, dev/MVP), KmsSigner (later), EnclaveSigner (later, Nautilus). Swapping
 * implementations MUST NOT change any other code (spec section 7).
 */
export interface Signer {
  /** 32 raw bytes, ed25519. */
  publicKey(): Promise<Uint8Array>;
  /** Raw 64-byte ed25519 signature over the exact message bytes. */
  sign(message: Uint8Array): Promise<Uint8Array>;
}

// An ed25519 private key IS a 32-byte seed; this is the fixed PKCS8 DER wrapper Node's
// crypto module expects around that seed so it can be imported as a KeyObject.
const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

function seedToDer(seed: Uint8Array): Buffer {
  return Buffer.concat([Buffer.from(PKCS8_ED25519_PREFIX), Buffer.from(seed)]);
}

/**
 * Signs with a plain ed25519 key held in this process's memory, loaded from a hex seed
 * (ORACLE_SIGNER_KEY). This is the v1/dev signer — no HSM, no enclave, no key rotation
 * beyond calling oracle_registry::set_signer with a new key.
 */
export class LocalKeySigner implements Signer {
  private readonly privateKeyDer: Buffer;
  private readonly pubkeyBytes: Uint8Array;

  constructor(seedHex: string) {
    const seed = hexToBytes(seedHex);
    if (seed.length !== 32) {
      throw new Error(`ORACLE_SIGNER_KEY must be a 32-byte hex seed, got ${seed.length} bytes`);
    }
    this.privateKeyDer = seedToDer(seed);
    const privateKey = createPrivateKey({ key: this.privateKeyDer, format: "der", type: "pkcs8" });
    const publicKey = createPublicKey(privateKey);
    const jwk = publicKey.export({ format: "jwk" });
    this.pubkeyBytes = new Uint8Array(Buffer.from(jwk.x as string, "base64url"));
  }

  async publicKey(): Promise<Uint8Array> {
    return this.pubkeyBytes;
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    const privateKey = createPrivateKey({ key: this.privateKeyDer, format: "der", type: "pkcs8" });
    return new Uint8Array(edSign(null, Buffer.from(message), privateKey));
  }
}
