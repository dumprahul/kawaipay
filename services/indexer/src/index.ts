import { createPgPool, MetricsRegistry, startMetricsServer } from "@kawaipay/shared";
import { loadConfig } from "./config.js";
import { SuiGraphQLEventSource } from "./eventSource.js";
import { startIndexer } from "./indexer.js";
import { registerIndexerMetrics } from "./metrics.js";

const config = loadConfig();
const pg = createPgPool(config.databaseUrl);
const eventSource = new SuiGraphQLEventSource(config.packageId, config.graphqlUrl, config.network);

const registry = new MetricsRegistry();
const metrics = registerIndexerMetrics(registry);
startMetricsServer(config.metricsPort, registry);

const log = (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ msg, ...meta }));

log("kawaipay-indexer starting", { packageId: config.packageId, graphqlUrl: config.graphqlUrl });
startIndexer(pg, eventSource, log, metrics);
