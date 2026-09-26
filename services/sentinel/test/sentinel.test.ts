import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { MetricsRegistry } from "@kawaipay/shared";
import { registerSentinelMetrics, runSentinelCycle } from "../src/sentinel.js";
import { createTestDatabase, seedCampaignAndLink, seedTick } from "./testHarness.js";

let pg: Pool;
const NOW = 1_800_000_000_000;
const LOOKBACK_MS = 60 * 60 * 1000;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_sentinel_cycle_test");
}, 30_000);

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links, sessions, ticks, link_risk, risk_flags CASCADE");
});

afterAll(async () => {
  await pg.end();
});

describe("runSentinelCycle", () => {
  it("leaves a clean link's risk state untouched (default weightMultiplier 1.0, no hold)", async () => {
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "10".repeat(32));
    for (let i = 0; i < 25; i++) {
      await seedTick(pg, linkId, `10000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, String(i).padStart(2, "0"), i, new Date(NOW - 1000));
    }
    const summary = await runSentinelCycle(pg, { lookbackMs: LOOKBACK_MS, nowMs: NOW });
    expect(summary).toEqual({ evaluated: 1, newFlags: 0, linksOnHold: 0 });

    const { rows } = await pg.query(`SELECT weight_multiplier, hold FROM link_risk WHERE link_id = $1`, [linkId]);
    expect(rows[0]).toMatchObject({ weight_multiplier: 1, hold: false });
  });

  it("holds a link exhibiting a bot signature and records a level-3 flag", async () => {
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "11".repeat(32));
    for (let i = 0; i < 25; i++) {
      await seedTick(pg, linkId, `11000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, String(i).padStart(2, "0"), i, new Date(NOW - 1000), {
        reasons: ["STATS_REPEATING"],
      });
    }
    const summary = await runSentinelCycle(pg, { lookbackMs: LOOKBACK_MS, nowMs: NOW });
    expect(summary.linksOnHold).toBe(1);
    expect(summary.newFlags).toBe(1);

    const { rows: riskRows } = await pg.query(`SELECT hold FROM link_risk WHERE link_id = $1`, [linkId]);
    expect(riskRows[0].hold).toBe(true);

    const { rows: flagRows } = await pg.query(`SELECT rule, level, resolved_at FROM risk_flags WHERE link_id = $1`, [linkId]);
    expect(flagRows).toEqual([{ rule: "BOT_SIGNATURE", level: 3, resolved_at: null }]);
  });

  it("flags SOURCE_CONCENTRATION (and reduces weight, without holding) when one IP dominates a link's sessions", async () => {
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "16".repeat(32));
    for (let i = 0; i < 10; i++) {
      await seedTick(pg, linkId, `16000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, "aa", i, new Date(NOW - 1000));
    }
    const summary = await runSentinelCycle(pg, { lookbackMs: LOOKBACK_MS, nowMs: NOW });
    expect(summary.newFlags).toBe(1);
    expect(summary.linksOnHold).toBe(0);

    const { rows } = await pg.query(`SELECT weight_multiplier, hold FROM link_risk WHERE link_id = $1`, [linkId]);
    expect(rows[0]).toMatchObject({ weight_multiplier: 0.5, hold: false });

    const { rows: flagRows } = await pg.query(`SELECT rule FROM risk_flags WHERE link_id = $1`, [linkId]);
    expect(flagRows).toEqual([{ rule: "SOURCE_CONCENTRATION" }]);
  });

  it("does not duplicate an already-unresolved flag for the same (link, rule) on a second cycle", async () => {
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "12".repeat(32));
    for (let i = 0; i < 25; i++) {
      await seedTick(pg, linkId, `12000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, String(i).padStart(2, "0"), i, new Date(NOW - 1000), {
        reasons: ["STATS_REPEATING"],
      });
    }
    const first = await runSentinelCycle(pg, { lookbackMs: LOOKBACK_MS, nowMs: NOW });
    const second = await runSentinelCycle(pg, { lookbackMs: LOOKBACK_MS, nowMs: NOW + 1000 });
    expect(first.newFlags).toBe(1);
    expect(second.newFlags).toBe(0);

    const { rows } = await pg.query(`SELECT count(*)::int AS n FROM risk_flags WHERE link_id = $1`, [linkId]);
    expect(rows[0].n).toBe(1);
  });

  it("self-heals: a previously-held link with clean recent activity is un-held on the next cycle", async () => {
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "13".repeat(32));
    await pg.query(`INSERT INTO link_risk (link_id, weight_multiplier, hold) VALUES ($1, 0.5, true)`, [linkId]);
    for (let i = 0; i < 25; i++) {
      await seedTick(pg, linkId, `13000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, String(i).padStart(2, "0"), i, new Date(NOW - 1000));
    }
    await runSentinelCycle(pg, { lookbackMs: LOOKBACK_MS, nowMs: NOW });
    const { rows } = await pg.query(`SELECT weight_multiplier, hold FROM link_risk WHERE link_id = $1`, [linkId]);
    expect(rows[0]).toMatchObject({ weight_multiplier: 1, hold: false });
  });

  it("records metrics when a registry is supplied", async () => {
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "14".repeat(32));
    for (let i = 0; i < 25; i++) {
      await seedTick(pg, linkId, `14000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, String(i).padStart(2, "0"), i, new Date(NOW - 1000), {
        reasons: ["STATS_REPEATING"],
      });
    }
    const registry = new MetricsRegistry();
    const metrics = registerSentinelMetrics(registry);
    await runSentinelCycle(pg, { lookbackMs: LOOKBACK_MS, nowMs: NOW }, metrics);

    const rendered = registry.render();
    expect(rendered).toContain("sentinel_links_evaluated_total 1");
    expect(rendered).toContain('sentinel_flags_raised_total{rule="BOT_SIGNATURE"} 1');
    expect(rendered).toContain("sentinel_links_on_hold 1");
  });

  it("emits a structured alert when a link is newly held", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { linkId } = await seedCampaignAndLink(pg, "0x" + "15".repeat(32));
    for (let i = 0; i < 25; i++) {
      await seedTick(pg, linkId, `15000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, String(i).padStart(2, "0"), i, new Date(NOW - 1000), {
        reasons: ["STATS_REPEATING"],
      });
    }
    await runSentinelCycle(pg, { lookbackMs: LOOKBACK_MS, nowMs: NOW });

    const alertCall = errorSpy.mock.calls.find((c) => JSON.parse(c[0] as string).alert === true);
    expect(alertCall).toBeDefined();
    const parsed = JSON.parse(alertCall![0] as string);
    expect(parsed).toMatchObject({ severity: "critical", code: "BOT_SIGNATURE", service: "sentinel" });
    errorSpy.mockRestore();
  });
});
