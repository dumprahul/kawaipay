import { LocalKeySigner } from "@kawaipay/oracle-core";
import { createPgPool, emitAlert, loadEnv, MetricsRegistry, startMetricsServer } from "@kawaipay/shared";
import { loadConfig } from "./config.js";
import { SuiGraphQLChainClient } from "./chainClient.js";
import { tryAcquireLeader } from "./leaderElection.js";
import { runCycle } from "./cycle.js";
import { resolveUnknownOutcome } from "./unknownOutcome.js";
import { estimateIndexerLagMs } from "./guards.js";
import { registerBatcherMetrics } from "./metrics.js";

loadEnv();
const config = loadConfig();
// The leader election below holds one dedicated session-level advisory lock connection
// (leaderElection.ts) — this MUST be a direct/session-mode connection to Postgres, not a
// transaction-mode pooler (e.g. Supabase's default pgbouncer pooler), which can hand a
// "session" a different underlying connection between queries and silently break the lock.
const pg = createPgPool(config.databaseUrl);
const chain = new SuiGraphQLChainClient(config.graphqlUrl, config.network, config.relayerKeyHex);
const signer = new LocalKeySigner(config.oracleSignerKeyHex);
const log = (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ msg, ...meta }));

const registry = new MetricsRegistry();
const metrics = registerBatcherMetrics(registry);
startMetricsServer(config.metricsPort, registry);

const LOG_SECRET = process.env.LOG_SECRET ?? "dev-log-secret-change-me";

async function resolveInFlightBatches(): Promise<void> {
  const { rows } = await pg.query(`SELECT batch_id, tx_digest FROM batches WHERE status IN ('building', 'submitted')`);
  for (const row of rows) {
    if (!row.tx_digest) {
      // Never got as far as recording a digest: nothing to look up, just fail it.
      await pg.query(`UPDATE batches SET status = 'failed', error = 'no digest recorded before restart' WHERE batch_id = $1`, [row.batch_id]);
      continue;
    }
    const { rows: itemRows } = await pg.query(`SELECT MAX(expires_at_ms) AS max_expires FROM batch_items WHERE batch_id = $1`, [row.batch_id]);
    const maxExpiresAtMs = Number(itemRows[0]?.max_expires ?? 0);
    const resolution = await resolveUnknownOutcome(chain, pg, row.batch_id, row.tx_digest, maxExpiresAtMs, Date.now());
    log("resolved in-flight batch on restart", { batchId: row.batch_id, resolution });
  }
}

async function main() {
  const leaderClient = await tryAcquireLeader(pg);
  if (!leaderClient) {
    log("another instance holds the batcher leader lock; idling");
    return;
  }
  log("acquired batcher leader lock");

  await resolveInFlightBatches();

  while (true) {
    const cycleStart = Date.now();
    try {
      const [indexerLagMs, relayerSuiBalance] = await Promise.all([estimateIndexerLagMs(pg), chain.getSuiBalance(chain.relayerAddress)]);
      metrics.indexerLagMs.set(Number.isFinite(indexerLagMs) ? indexerLagMs : -1);
      metrics.relayerSuiBalance.set(relayerSuiBalance);

      const outcome = await runCycle(
        { pg, chain, signer },
        {
          maxItemsPerBatch: config.maxItemsPerBatch,
          mirrorMaxLagMs: config.mirrorMaxLagMs,
          relayerMinSui: config.relayerMinSui,
          packageId: config.packageId,
          registryId: config.registryId,
          usdcType: config.usdcType,
          logSecret: LOG_SECRET,
          gasBudgetPerItem: 50_000_000,
        },
      );
      log("cycle complete", { outcome });

      metrics.cyclesTotal.inc({ kind: outcome.kind });
      metrics.lastBatchDurationMs.set(Date.now() - cycleStart);
      if (outcome.kind === "submitted") {
        metrics.lastItemsPerBatch.set(outcome.itemCount);
        metrics.itemsFailedTotal.inc(undefined, outcome.failedCount);
      } else if (outcome.kind === "all_failed_dry_run") {
        metrics.itemsFailedTotal.inc(undefined, outcome.failedCount);
      }
      for (const alert of outcome.alerts) {
        emitAlert("batcher", "warning", alert.reason, `link ${alert.linkId} alerted during batch reservation`, {
          linkId: alert.linkId,
          detail: alert.detail,
        });
      }
      // BATCH_ALREADY_SUBMITTED is routine (expected whenever a batch is in flight) —
      // only the two guards that signal a real operational problem are alert-worthy.
      if (outcome.kind === "skipped_guard" && outcome.guard !== "BATCH_ALREADY_SUBMITTED") {
        emitAlert("batcher", "critical", outcome.guard, "batcher cycle skipped by a guard", { guard: outcome.guard });
      }
    } catch (err) {
      log("cycle failed", { error: err instanceof Error ? err.message : String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, config.batchIntervalMs));
  }
}

main();
