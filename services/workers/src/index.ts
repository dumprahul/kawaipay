import { loadEnv } from "@kawaipay/shared";
import { runBatcherService } from "../../batcher/src/main.js";
import { runIndexerService } from "../../indexer/src/main.js";
import { runLogWriterService } from "../../log-writer/src/main.js";
import { runSentinelService } from "../../sentinel/src/main.js";

/**
 * Combined entrypoint for the four background/worker services (ticket: Railway
 * free-tier consolidation). Each of `batcher`, `indexer`, `log-writer`, `sentinel` is a
 * self-contained infinite polling loop with no public HTTP surface (only its own
 * internal /metrics port) — there's no reason they need to be four separate Railway
 * services, and running them as one process fits under Railway's free-tier resource
 * cap. This file adds no new logic: it just calls the exact same `run*Service()`
 * functions each service's own standalone `index.ts` calls, reusing 100% of the
 * already-tested code.
 *
 * Each is wrapped so one crashing at startup can't take the others down with it — the
 * same "isolate failure domains" principle every one of their own internal loops
 * already follows. Each keeps its own METRICS_PORT (unchanged env var names), so all
 * four /metrics endpoints stay reachable inside this one container.
 */
loadEnv();

const log = (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ msg, service: "workers", ...meta }));

const services: { name: string; run: () => Promise<void> }[] = [
  { name: "batcher", run: runBatcherService },
  { name: "indexer", run: runIndexerService },
  { name: "log-writer", run: runLogWriterService },
  { name: "sentinel", run: runSentinelService },
];

for (const service of services) {
  service.run().catch((err) => {
    log("a worker crashed and will not be restarted — check its own logs above", {
      worker: service.name,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

log("all workers started", { services: services.map((s) => s.name) });
