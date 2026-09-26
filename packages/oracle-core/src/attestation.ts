import {
  ATT_TTL_MS,
  MAX_TICKS_PER_ATTESTATION,
  MIN_SETTLE_UNITS,
  SKIP_MIN_SETTLE_AGE_MS,
  TICK_SECONDS,
  bytesToHex,
  canonicalTickRecordJson,
  computeLogRoot,
  encodePayoutMessage,
  type Attestation,
  type BaseUnits,
  type ObjectId,
  type TickLogRecord,
} from "@kawaipay/shared";
import type { Signer } from "./signer.js";

/** One unbatched tick, eligible for settlement if record.a (its amount) is above zero. */
export interface CandidateTick {
  tickId: string;
  receivedAtMs: number;
  record: TickLogRecord;
}

export interface LinkSettleContext {
  campaignId: ObjectId;
  linkId: ObjectId;
  /** The chain-confirmed next sequence number — never computed locally. */
  nextSeq: number;
  budgetRemaining: BaseUnits;
  maxRatePerSecond: BaseUnits;
  perSettleCap: BaseUnits;
  nowMs: number;
}

export type AttestationBuildResult =
  | {
      kind: "built";
      attestation: Attestation;
      message: Uint8Array;
      signature: Uint8Array;
      selectedTickIds: string[];
      logRootHex: string;
    }
  | { kind: "skipped"; reason: "no_eligible_ticks" | "below_min_settle" }
  | { kind: "alert"; reason: "rate_exceeded_sanity_check"; amount: number; secondsVerified: number; maxAllowed: number };

/**
 * Builds and signs one link's attestation for this batch cycle (spec section 7,
 * "Attestation building"). Pure aside from the signer call: given the same context,
 * candidates and signer, it always selects the same ticks and produces the same message.
 */
export async function buildAttestation(
  ctx: LinkSettleContext,
  candidatesOldestFirst: CandidateTick[],
  signer: Signer,
): Promise<AttestationBuildResult> {
  // Step 2: unbatched ticks with amount above zero, oldest first, up to one hour's worth.
  const eligible = candidatesOldestFirst.filter((c) => c.record.a > 0).slice(0, MAX_TICKS_PER_ATTESTATION);
  if (eligible.length === 0) {
    return { kind: "skipped", reason: "no_eligible_ticks" };
  }

  // Step 3: stop adding ticks once the running total would exceed either cap; the rest
  // stay pending for the next cycle.
  const selected: CandidateTick[] = [];
  let runningAmount = 0;
  for (const c of eligible) {
    const next = runningAmount + c.record.a;
    if (next > ctx.perSettleCap || next > ctx.budgetRemaining) break;
    selected.push(c);
    runningAmount = next;
  }
  if (selected.length === 0) {
    return { kind: "skipped", reason: "no_eligible_ticks" };
  }

  // Step 4
  const amount = runningAmount;
  const secondsVerified = TICK_SECONDS * selected.length;

  // Step 5: sanity check against the campaign's on-chain rate ceiling.
  const maxAllowed = ctx.maxRatePerSecond * secondsVerified;
  if (amount > maxAllowed) {
    return { kind: "alert", reason: "rate_exceeded_sanity_check", amount, secondsVerified, maxAllowed };
  }

  // Step 6: below the minimum settle size, unless the oldest selected tick has waited too long.
  const oldest = selected[0]!;
  const oldestAgeMs = ctx.nowMs - oldest.receivedAtMs;
  if (amount < MIN_SETTLE_UNITS && oldestAgeMs <= SKIP_MIN_SETTLE_AGE_MS) {
    return { kind: "skipped", reason: "below_min_settle" };
  }

  // Step 7
  const logRoot = computeLogRoot(selected.map((c) => canonicalTickRecordJson(c.record)));

  // Step 8
  const expiresAtMs = ctx.nowMs + ATT_TTL_MS;

  const attestation: Attestation = {
    campaignId: ctx.campaignId,
    linkId: ctx.linkId,
    seq: ctx.nextSeq,
    secondsVerified,
    amount,
    logRoot,
    expiresAtMs,
  };

  // Step 9
  const message = encodePayoutMessage(attestation);
  const signature = await signer.sign(message);

  return {
    kind: "built",
    attestation,
    message,
    signature,
    selectedTickIds: selected.map((c) => c.tickId),
    logRootHex: bytesToHex(logRoot),
  };
}
