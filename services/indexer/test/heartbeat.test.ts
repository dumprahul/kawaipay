import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { MetricsRegistry } from "@kawaipay/shared";
import { getHeartbeatLagMs, touchHeartbeat } from "../src/heartbeat.js";
import { runModuleLoop } from "../src/indexer.js";
import { cursorName } from "../src/cursor.js";
import { registerIndexerMetrics } from "../src/metrics.js";
import { createTestDatabase, ev, FakeEventSource } from "./testHarness.js";

let pg: Pool;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_indexer_heartbeat_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE indexer_heartbeat, indexer_cursor, campaigns CASCADE");
});

afterAll(async () => {
  await pg.end();
});

describe("touchHeartbeat / getHeartbeatLagMs", () => {
  it("returns null when nothing has ever polled", async () => {
    expect(await getHeartbeatLagMs(pg, Date.now())).toBeNull();
  });

  it("reports near-zero lag right after a touch, growing lag as time passes without one", async () => {
    await touchHeartbeat(pg, "kawaipay-events:campaign");
    // getHeartbeatLagMs measures against the DB's own now() timestamp, not our fixed t0,
    // so just assert it's small right after touching.
    expect(await getHeartbeatLagMs(pg, Date.now())).toBeLessThan(2000);
  });

  it("reports the OLDEST module's lag when several have polled at different times", async () => {
    await touchHeartbeat(pg, "kawaipay-events:campaign");
    await pg.query(`UPDATE indexer_heartbeat SET last_polled_at = now() - interval '5 minutes' WHERE name = 'kawaipay-events:campaign'`);
    await touchHeartbeat(pg, "kawaipay-events:link"); // just touched, fresh

    const lag = await getHeartbeatLagMs(pg, Date.now());
    expect(lag).toBeGreaterThan(4 * 60 * 1000); // driven by the stale campaign row, not the fresh link one
  });
});

describe("runModuleLoop", () => {
  it("touches the module's heartbeat every poll, even when no events are found", async () => {
    const source = new FakeEventSource(); // no events configured -> every poll is empty
    let ticks = 0;
    await runModuleLoop(pg, source, "campaign", () => ticks++ < 1, () => {});

    const { rows } = await pg.query(`SELECT last_polled_at FROM indexer_heartbeat WHERE name = $1`, [cursorName("campaign")]);
    expect(rows).toHaveLength(1);
    expect(await getHeartbeatLagMs(pg, Date.now())).toBeLessThan(2000);
  }, 15_000);

  it("records poll and processed-event counts when a metrics registry is supplied", async () => {
    const source = new FakeEventSource();
    source.setEvents("campaign", [
      ev("CampaignCreated", "campaign", "tx-1", 0, {
        campaign_id: "campaign-metrics-test",
        seller: "0xseller",
        rate_per_second: "1",
        max_rate_per_second: "2",
        per_settle_cap: "3",
        per_link_epoch_cap: "4",
        open_links: true,
      }),
    ]);
    const registry = new MetricsRegistry();
    const metrics = registerIndexerMetrics(registry);

    let ticks = 0;
    await runModuleLoop(pg, source, "campaign", () => ticks++ < 1, () => {}, metrics);

    const rendered = registry.render();
    expect(rendered).toContain('indexer_polls_total{module="campaign"} 1');
    expect(rendered).toContain('indexer_events_processed_total{module="campaign"} 1');
  }, 15_000);
});
