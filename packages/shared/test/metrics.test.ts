import { describe, expect, it } from "vitest";
import { MetricsRegistry } from "../src/metrics.js";

describe("MetricsRegistry", () => {
  it("renders a counter with no labels", () => {
    const registry = new MetricsRegistry();
    const c = registry.counter("things_total", "count of things");
    c.inc();
    c.inc();
    expect(registry.render()).toBe("# HELP things_total count of things\n# TYPE things_total counter\nthings_total 2\n");
  });

  it("accumulates separately per label combination", () => {
    const registry = new MetricsRegistry();
    const c = registry.counter("events_total", "events by module");
    c.inc({ module: "campaign" });
    c.inc({ module: "campaign" }, 4);
    c.inc({ module: "link" });
    const rendered = registry.render();
    expect(rendered).toContain('events_total{module="campaign"} 5');
    expect(rendered).toContain('events_total{module="link"} 1');
  });

  it("supports gauges, which overwrite rather than accumulate", () => {
    const registry = new MetricsRegistry();
    const g = registry.gauge("lag_ms", "indexer lag");
    g.set(100);
    g.set(50);
    expect(registry.render()).toContain("lag_ms 50");
    expect(registry.render()).not.toContain("lag_ms 100");
  });

  it("renders multiple metrics together in one document", () => {
    const registry = new MetricsRegistry();
    registry.counter("a_total", "a").inc();
    registry.gauge("b", "b").set(1);
    const rendered = registry.render();
    expect(rendered).toContain("a_total 1");
    expect(rendered).toContain("b 1");
  });

  it("labels are sorted consistently regardless of insertion order", () => {
    const registry = new MetricsRegistry();
    const c = registry.counter("x_total", "x");
    c.inc({ b: "2", a: "1" });
    expect(registry.render()).toContain('x_total{a="1",b="2"} 1');
  });
});
