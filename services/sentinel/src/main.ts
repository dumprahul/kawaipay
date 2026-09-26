import { createPgPool, MetricsRegistry, startMetricsServer } from "@kawaipay/shared";
import { loadConfig } from "./config.js";
import { registerSentinelMetrics, runSentinelCycle } from "./sentinel.js";

/** The sentinel's whole runtime as one callable function — see services/batcher/src/main.ts for why. */
export async function runSentinelService(): Promise<void> {
  const config = loadConfig();
  const pg = createPgPool(config.databaseUrl);
  const registry = new MetricsRegistry();
  const metrics = registerSentinelMetrics(registry);
  startMetricsServer(config.metricsPort, registry);

  const log = (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ msg, service: "sentinel", ...meta }));

  while (true) {
    try {
      const summary = await runSentinelCycle(pg, { lookbackMs: config.lookbackMs, nowMs: Date.now() }, metrics);
      log("sentinel cycle complete", { ...summary });
    } catch (err) {
      log("sentinel cycle failed", { error: err instanceof Error ? err.message : String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}
