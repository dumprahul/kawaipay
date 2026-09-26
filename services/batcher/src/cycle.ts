import type { Pool } from "pg";
import type { Signer } from "@kawaipay/oracle-core";
import type { ChainClient } from "./chainClient.js";
import { checkGuards, estimateIndexerLagMs, hasSubmittedBatch, type GuardFailure } from "./guards.js";
import { markBatchStatus, markItemStatus, releaseItem, reserveBatch, selectEligibleLinks, type ReservedItem } from "./selection.js";
import { dryRunAndBisect } from "./dryRunBisect.js";
import { buildSettleTransaction, type PtbConfig } from "./ptb.js";

export interface CycleConfig {
  maxItemsPerBatch: number;
  mirrorMaxLagMs: number;
  relayerMinSui: number;
  packageId: string;
  registryId: string;
  usdcType: string;
  logSecret: string;
  /** Fixed per-item gas budget until a proper dry-run-based estimate is wired in (see note below). */
  gasBudgetPerItem: number;
}

export interface CycleDeps {
  pg: Pool;
  chain: ChainClient;
  signer: Signer;
}

export interface CycleAlert {
  linkId: string;
  reason: string;
  detail: unknown;
}

export type CycleOutcome =
  | { kind: "skipped_guard"; guard: GuardFailure; alerts: CycleAlert[] }
  | { kind: "idle"; alerts: CycleAlert[] }
  | { kind: "all_failed_dry_run"; batchId: number; failedCount: number; alerts: CycleAlert[] }
  | {
      kind: "submitted";
      batchId: number;
      digest: string;
      itemCount: number;
      failedCount: number;
      success: boolean;
      alerts: CycleAlert[];
      /** Every creator payout in this batch, for Railway log visibility — who got paid, how much, for what link. */
      items: { linkId: string; campaignId: string; amountUsdcBaseUnits: number; secondsVerified: number }[];
    };

/**
 * One full batcher cycle (spec section 8). Gas budgeting here is a fixed per-item
 * amount rather than `Math.ceil(dryRunGasEstimate * 1.3)` from the spec's example — a
 * precise estimate needs the dry-run's gas usage figure, which is a refinement left for
 * later; a generous fixed budget is safe (unused gas is refunded) if less optimal.
 */
export async function runCycle(deps: CycleDeps, config: CycleConfig): Promise<CycleOutcome> {
  const { pg, chain, signer } = deps;

  const [submitted, relayerBalance, indexerLagMs] = await Promise.all([
    hasSubmittedBatch(pg),
    chain.getSuiBalance(chain.relayerAddress),
    estimateIndexerLagMs(pg),
  ]);
  const guardFailure = checkGuards(
    { indexerLagMs, hasSubmittedBatch: submitted, relayerSuiBalance: relayerBalance },
    { mirrorMaxLagMs: config.mirrorMaxLagMs, relayerMinSui: config.relayerMinSui },
  );
  if (guardFailure) {
    return { kind: "skipped_guard", guard: guardFailure, alerts: [] };
  }

  const links = await selectEligibleLinks(pg, config.maxItemsPerBatch);
  if (links.length === 0) {
    return { kind: "idle", alerts: [] };
  }

  const reserved = await reserveBatch(pg, signer, links, config.logSecret, Date.now());
  if (reserved.batchId === null || reserved.items.length === 0) {
    return { kind: "idle", alerts: reserved.alerts };
  }

  const ptbConfig: PtbConfig = { packageId: config.packageId, registryId: config.registryId, usdcType: config.usdcType };
  const bisected = await dryRunAndBisect(chain, reserved.items, ptbConfig);

  for (const { item, error } of bisected.failed) {
    await releaseItem(pg, item.itemId, error);
  }

  if (bisected.succeeded.length === 0) {
    await markBatchStatus(pg, reserved.batchId, "failed", "all items failed dry-run");
    return { kind: "all_failed_dry_run", batchId: reserved.batchId, failedCount: bisected.failed.length, alerts: reserved.alerts };
  }

  const finalTx = buildSettleTransaction(bisected.succeeded, ptbConfig);
  finalTx.setGasBudget(config.gasBudgetPerItem * bisected.succeeded.length);

  // The SDK's signAndExecuteTransaction bundles signing, broadcast and waiting for
  // effects into one call, so the digest is only known once it returns — a deliberate
  // adaptation of the spec's "sign, record digest, mark submitted, then send" ordering,
  // which assumed those were separable steps. The digest is still persisted before this
  // function interprets success/failure, so a crash right after this line leaves enough
  // for resolveUnknownOutcome to pick the batch back up on restart.
  const outcome = await chain.signAndSubmit(finalTx);
  await markBatchStatus(pg, reserved.batchId, "submitted", undefined, outcome.digest);

  if (outcome.success) {
    await markBatchStatus(pg, reserved.batchId, "confirmed", undefined, outcome.digest);
    for (const item of bisected.succeeded as ReservedItem[]) {
      await markItemStatus(pg, item.itemId, "confirmed");
    }
  } else {
    await markBatchStatus(pg, reserved.batchId, "failed", outcome.error ?? `abort code ${outcome.abortCode ?? "unknown"}`, outcome.digest);
    for (const item of bisected.succeeded as ReservedItem[]) {
      await releaseItem(pg, item.itemId, outcome.error ?? "on-chain abort");
    }
  }

  return {
    kind: "submitted",
    batchId: reserved.batchId,
    digest: outcome.digest,
    itemCount: bisected.succeeded.length,
    failedCount: bisected.failed.length,
    success: outcome.success,
    alerts: reserved.alerts,
    items: (bisected.succeeded as ReservedItem[]).map((item) => ({
      linkId: item.linkId,
      campaignId: item.campaignId,
      amountUsdcBaseUnits: item.amount,
      secondsVerified: item.secondsVerified,
    })),
  };
}
