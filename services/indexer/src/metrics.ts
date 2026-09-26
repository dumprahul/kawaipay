import { MetricsRegistry } from "@kawaipay/shared";

export function registerIndexerMetrics(registry: MetricsRegistry) {
  return {
    eventsProcessed: registry.counter("indexer_events_processed_total", "events applied to the mirror, by module"),
    pollsTotal: registry.counter("indexer_polls_total", "poll cycles completed, by module"),
  };
}

export type IndexerMetrics = ReturnType<typeof registerIndexerMetrics>;
