import { createPgPool, MetricsRegistry, startMetricsServer } from "@kawaipay/shared";
import { loadConfig } from "./config.js";
import { LocalFsStore } from "./logStore.js";
import { registerLogWriterMetrics } from "./metrics.js";
import { writePendingLogs } from "./writer.js";

/** The log-writer's whole runtime as one callable function — see services/batcher/src/main.ts for why. */
export async function runLogWriterService(): Promise<void> {
  const config = loadConfig();
  const pg = createPgPool(config.databaseUrl);
  const logStore = new LocalFsStore(config.logStoreDir);
  const log = (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ msg, service: "log-writer", ...meta }));

  const registry = new MetricsRegistry();
  const metrics = registerLogWriterMetrics(registry);
  startMetricsServer(config.metricsPort, registry);

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
