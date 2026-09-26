import { createPublicKey, verify as edVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bytesToHex, encodePayoutMessage, type BucketedStats, type TickLogRecord } from "@kawaipay/shared";
import { buildAttestation, type CandidateTick, type LinkSettleContext } from "../src/attestation.js";
import { LocalKeySigner } from "../src/signer.js";

const SEED_HEX = "432d7a9ffdc34a879a9f139787f5f9ae21bcd1570c86ed2210eb845972330c8";
const CAMPAIGN_ID = "0x" + "aa".repeat(32);
const LINK_ID = "0x" + "bb".repeat(32);

const SPKI_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

function verifyEd25519(pubkey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  const der = Buffer.concat([Buffer.from(SPKI_ED25519_PREFIX), Buffer.from(pubkey)]);
  const publicKey = createPublicKey({ key: der, format: "der", type: "spki" });
  return edVerify(null, Buffer.from(message), publicKey, Buffer.from(signature));
}

const BASE_STATS: BucketedStats = {
  windowMs: 5000,
  visibleMs: 5000,
  focusedMs: 5000,
  inViewportMs: 5000,
  cvrPct: 100,
  scrollEvents: 5,
  scrollDepthPct: 40,
  scrollSpeedMax: 500,
  pointerMoves: 10,
  pointerCells: 6,
  touchEvents: 0,
  keyEvents: 0,
  tabSwitches: 0,
};

function candidate(tickId: string, amount: number, receivedAtMs: number, n = 1): CandidateTick {
  const record: TickLogRecord = {
    v: 1,
    sid: "abcdef0123456789",
    t: receivedAtMs,
    n,
    gap: 5000,
    ipc: "residential",
    f: BASE_STATS,
    sc: 900,
    vd: "pay",
    w: 10000,
    a: amount,
    r: [],
    sv: "1.0.0",
  };
  return { tickId, receivedAtMs, record };
}

function baseCtx(overrides: Partial<LinkSettleContext> = {}): LinkSettleContext {
  return {
    campaignId: CAMPAIGN_ID,
    linkId: LINK_ID,
    nextSeq: 0,
    budgetRemaining: 1_000_000,
    maxRatePerSecond: 1000,
    perSettleCap: 100_000,
    nowMs: 1_800_000_000_000,
    ...overrides,
  };
}

describe("buildAttestation", () => {
  it("builds and signs a valid attestation end-to-end, verifiable against the signer's pubkey", async () => {
    const signer = new LocalKeySigner(SEED_HEX);
    const candidates = [candidate("t1", 600, 1_799_999_990_000), candidate("t2", 500, 1_799_999_995_000)];
    const ctx = baseCtx();

    const result = await buildAttestation(ctx, candidates, signer);
    expect(result.kind).toBe("built");
    if (result.kind !== "built") throw new Error("expected built");

    expect(result.attestation.amount).toBe(1100);
    expect(result.attestation.secondsVerified).toBe(10); // 2 ticks * TICK_SECONDS
    expect(result.attestation.seq).toBe(0);
    expect(result.attestation.expiresAtMs).toBe(ctx.nowMs + 60_000);
    expect(result.selectedTickIds).toEqual(["t1", "t2"]);

    // The returned message must equal an independently-computed encodePayoutMessage.
    expect(bytesToHex(result.message)).toBe(bytesToHex(encodePayoutMessage(result.attestation)));

    // And the signature must actually verify against the signer's own public key.
    const pubkey = await signer.publicKey();
    expect(verifyEd25519(pubkey, result.message, result.signature)).toBe(true);
  });

  it("stops selecting ticks once the running amount would exceed per_settle_cap", async () => {
    const signer = new LocalKeySigner(SEED_HEX);
    const candidates = [
      candidate("t1", 60_000, 1_799_999_990_000),
      candidate("t2", 60_000, 1_799_999_995_000), // would push total to 120,000 > cap
    ];
    const ctx = baseCtx({ perSettleCap: 100_000, budgetRemaining: 1_000_000, maxRatePerSecond: 100_000 });

    const result = await buildAttestation(ctx, candidates, signer);
    expect(result.kind).toBe("built");
    if (result.kind !== "built") throw new Error("expected built");
    expect(result.attestation.amount).toBe(60_000);
    expect(result.selectedTickIds).toEqual(["t1"]);
  });

  it("stops selecting ticks once the running amount would exceed the link's remaining budget", async () => {
    const signer = new LocalKeySigner(SEED_HEX);
    const candidates = [candidate("t1", 5_000, 1_799_999_990_000), candidate("t2", 5_000, 1_799_999_995_000)];
    const ctx = baseCtx({ budgetRemaining: 6_000, perSettleCap: 100_000, maxRatePerSecond: 100_000 });

    const result = await buildAttestation(ctx, candidates, signer);
    expect(result.kind).toBe("built");
    if (result.kind !== "built") throw new Error("expected built");
    expect(result.attestation.amount).toBe(5_000);
    expect(result.selectedTickIds).toEqual(["t1"]);
  });

  it("raises an alert instead of building when the amount would exceed the rate ceiling", async () => {
    const signer = new LocalKeySigner(SEED_HEX);
    // 1 tick = 5s verified; max_rate_per_second=10 -> max allowed = 50, but amount=1000.
    const candidates = [candidate("t1", 1000, 1_799_999_990_000)];
    const ctx = baseCtx({ maxRatePerSecond: 10, perSettleCap: 1_000_000, budgetRemaining: 1_000_000 });

    const result = await buildAttestation(ctx, candidates, signer);
    expect(result).toEqual({ kind: "alert", reason: "rate_exceeded_sanity_check", amount: 1000, secondsVerified: 5, maxAllowed: 50 });
  });

  it("skips a link below MIN_SETTLE_UNITS when its oldest tick is still fresh", async () => {
    const signer = new LocalKeySigner(SEED_HEX);
    const candidates = [candidate("t1", 500, 1_799_999_999_000)]; // below 1,000, and only 1s old
    const ctx = baseCtx({ nowMs: 1_800_000_000_000 });

    const result = await buildAttestation(ctx, candidates, signer);
    expect(result).toEqual({ kind: "skipped", reason: "below_min_settle" });
  });

  it("builds anyway when below MIN_SETTLE_UNITS but the oldest tick has waited past the age threshold", async () => {
    const signer = new LocalKeySigner(SEED_HEX);
    const oldTickReceivedAt = 1_800_000_000_000 - 301_000; // 301s old > 300s threshold
    const candidates = [candidate("t1", 500, oldTickReceivedAt)];
    const ctx = baseCtx({ nowMs: 1_800_000_000_000 });

    const result = await buildAttestation(ctx, candidates, signer);
    expect(result.kind).toBe("built");
    if (result.kind !== "built") throw new Error("expected built");
    expect(result.attestation.amount).toBe(500);
  });

  it("skips when there are no eligible (amount > 0) ticks", async () => {
    const signer = new LocalKeySigner(SEED_HEX);
    const candidates = [candidate("t1", 0, 1_799_999_990_000)];
    const result = await buildAttestation(baseCtx(), candidates, signer);
    expect(result).toEqual({ kind: "skipped", reason: "no_eligible_ticks" });
  });

  it("skips when given zero candidates", async () => {
    const signer = new LocalKeySigner(SEED_HEX);
    const result = await buildAttestation(baseCtx(), [], signer);
    expect(result).toEqual({ kind: "skipped", reason: "no_eligible_ticks" });
  });

  it("caps selection at 720 ticks (one hour), leaving the rest pending", async () => {
    const signer = new LocalKeySigner(SEED_HEX);
    const candidates = Array.from({ length: 721 }, (_, i) => candidate(`t${i}`, 1, 1_799_999_000_000 + i * 5000));
    const ctx = baseCtx({ perSettleCap: 10_000, budgetRemaining: 10_000, maxRatePerSecond: 100_000 });

    const result = await buildAttestation(ctx, candidates, signer);
    expect(result.kind).toBe("built");
    if (result.kind !== "built") throw new Error("expected built");
    expect(result.selectedTickIds.length).toBe(720);
    expect(result.selectedTickIds).not.toContain("t720");
    expect(result.attestation.secondsVerified).toBe(720 * 5);
  });

  it("uses the log_root produced by the shared Merkle implementation, not an ad-hoc hash", async () => {
    const signer = new LocalKeySigner(SEED_HEX);
    const candidates = [candidate("t1", 1200, 1_799_999_990_000)];
    const result = await buildAttestation(baseCtx(), candidates, signer);
    if (result.kind !== "built") throw new Error("expected built");
    expect(result.attestation.logRoot.length).toBe(32);
    expect(result.logRootHex).toBe(bytesToHex(result.attestation.logRoot));
  });
});
