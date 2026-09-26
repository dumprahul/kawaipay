import { MetricsRegistry } from "@kawaipay/shared";

/** Spec section 8's required metrics, exposed as real Prometheus series (ticket J1). */
export function registerBatcherMetrics(registry: MetricsRegistry) {
  return {
    cyclesTotal: registry.counter("batcher_cycles_total", "batcher cycles run, by outcome kind"),
    itemsFailedTotal: registry.counter("batcher_items_failed_total", "batch items released as failed"),
    lastBatchDurationMs: registry.gauge("batcher_last_batch_duration_ms", "duration of the most recent cycle"),
    lastItemsPerBatch: registry.gauge("batcher_last_items_per_batch", "item count in the most recently submitted batch"),
    indexerLagMs: registry.gauge("batcher_indexer_lag_ms", "ms since the indexer's least-recently-polled module last ran"),
    relayerSuiBalance: registry.gauge("batcher_relayer_sui_balance", "relayer wallet's current SUI balance, base units"),
  };
}

export type BatcherMetrics = ReturnType<typeof registerBatcherMetrics>;
