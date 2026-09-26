import { createServer, type Server } from "node:http";
import type { MetricsRegistry } from "./metrics.js";

/**
 * Serves a registry's Prometheus text output at GET /metrics on its own port — for the
 * daemon-style services (batcher, indexer, log-writer, sentinel) that have no other HTTP
 * server to hang a route off of. Anything else 404s.
 */
export function startMetricsServer(port: number, registry: MetricsRegistry): Server {
  const server = createServer((req, res) => {
    if (req.url === "/metrics" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
      res.end(registry.render());
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port);
  return server;
}
