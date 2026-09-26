import { createPgPool, loadEnv, MetricsRegistry, startMetricsServer } from "@kawaipay/shared";
import { loadConfig } from "./config.js";
import { LocalFsStore } from "./logStore.js";
import { registerLogWriterMetrics } from "./metrics.js";
import { writePendingLogs } from "./writer.js";

loadEnv();
const config = loadConfig();
const pg = createPgPool(config.databaseUrl);
const logStore = new LocalFsStore(config.logStoreDir);
const log = (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ msg, ...meta }));

const registry = new MetricsRegistry();
const metrics = registerLogWriterMetrics(registry);
startMetricsServer(config.metricsPort, registry);

async function main() {
  while (true) {
    try {
      const outcomes = await writePendingLogs(pg, logStore, config.logSecret, metrics);
      if (outcomes.length > 0) log("cycle complete", { outcomes });
    } catch (err) {
      log("cycle failed", { error: err instanceof Error ? err.message : String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main();
