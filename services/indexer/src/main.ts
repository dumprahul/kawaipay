import { createPgPool, MetricsRegistry, startMetricsServer } from "@kawaipay/shared";
import { loadConfig } from "./config.js";
import { SuiGraphQLEventSource } from "./eventSource.js";
import { startIndexer } from "./indexer.js";
import { registerIndexerMetrics } from "./metrics.js";

/** The indexer's whole runtime as one callable function — see services/batcher/src/main.ts for why. */
export async function runIndexerService(): Promise<void> {
  const config = loadConfig();
  const pg = createPgPool(config.databaseUrl);
  const eventSource = new SuiGraphQLEventSource(config.packageId, config.graphqlUrl, config.network);

  const registry = new MetricsRegistry();
  const metrics = registerIndexerMetrics(registry);
  startMetricsServer(config.metricsPort, registry);

  const log = (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ msg, service: "indexer", ...meta }));

  log("kawaipay-indexer starting", { packageId: config.packageId, graphqlUrl: config.graphqlUrl });
  await startIndexer(pg, eventSource, log, metrics).done;
}
