import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { MetricsRegistry } from "../src/metrics.js";
import { startMetricsServer } from "../src/metricsServer.js";

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
});

describe("startMetricsServer", () => {
  it("serves the registry's rendered output at GET /metrics over a real HTTP request", async () => {
    const registry = new MetricsRegistry();
    registry.counter("widgets_total", "widgets made").inc(undefined, 3);
    server = startMetricsServer(9464, registry);

    const res = await fetch("http://127.0.0.1:9464/metrics");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("widgets_total 3");
  });

  it("404s any other path", async () => {
    const registry = new MetricsRegistry();
    server = startMetricsServer(9465, registry);
    const res = await fetch("http://127.0.0.1:9465/anything-else");
    expect(res.status).toBe(404);
  });
});
