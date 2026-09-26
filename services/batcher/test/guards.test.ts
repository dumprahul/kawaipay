import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { checkGuards, estimateIndexerLagMs } from "../src/guards.js";
import { createTestDatabase } from "./testHarness.js";

const LIMITS = { mirrorMaxLagMs: 30_000, relayerMinSui: 100_000_000 };

describe("checkGuards", () => {
  it("passes (returns null) when everything is healthy", () => {
    expect(checkGuards({ indexerLagMs: 0, hasSubmittedBatch: false, relayerSuiBalance: 200_000_000 }, LIMITS)).toBeNull();
  });

  it("fails when indexer lag exceeds the limit", () => {
    expect(checkGuards({ indexerLagMs: 30_001, hasSubmittedBatch: false, relayerSuiBalance: 200_000_000 }, LIMITS)).toBe(
      "INDEXER_LAG_TOO_HIGH",
    );
  });

  it("does not fail at exactly the lag limit", () => {
    expect(checkGuards({ indexerLagMs: 30_000, hasSubmittedBatch: false, relayerSuiBalance: 200_000_000 }, LIMITS)).toBeNull();
  });

  it("fails when a batch is already submitted", () => {
    expect(checkGuards({ indexerLagMs: 0, hasSubmittedBatch: true, relayerSuiBalance: 200_000_000 }, LIMITS)).toBe(
      "BATCH_ALREADY_SUBMITTED",
    );
  });

  it("fails when relayer balance is below the minimum", () => {
    expect(checkGuards({ indexerLagMs: 0, hasSubmittedBatch: false, relayerSuiBalance: 99_999_999 }, LIMITS)).toBe(
      "RELAYER_BALANCE_TOO_LOW",
    );
  });

  it("checks lag before submitted-batch before balance (first failing guard wins)", () => {
    expect(checkGuards({ indexerLagMs: 999_999, hasSubmittedBatch: true, relayerSuiBalance: 0 }, LIMITS)).toBe("INDEXER_LAG_TOO_HIGH");
  });
});

describe("estimateIndexerLagMs", () => {
  let pg: Pool;

  beforeAll(async () => {
    pg = await createTestDatabase("kawaipay_batcher_guards_test");
  }, 30_000);

  beforeEach(async () => {
    await pg.query("TRUNCATE indexer_heartbeat");
  });

  afterAll(async () => {
    await pg.end();
  });

  it("returns +Infinity when the indexer has never polled", async () => {
    expect(await estimateIndexerLagMs(pg)).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns a small lag right after a poll", async () => {
    await pg.query(`INSERT INTO indexer_heartbeat (name, last_polled_at) VALUES ('kawaipay-events:campaign', now())`);
    expect(await estimateIndexerLagMs(pg)).toBeLessThan(2000);
  });

  it("reports the oldest module's lag, not the freshest", async () => {
    await pg.query(`INSERT INTO indexer_heartbeat (name, last_polled_at) VALUES ('kawaipay-events:campaign', now() - interval '1 minute')`);
    await pg.query(`INSERT INTO indexer_heartbeat (name, last_polled_at) VALUES ('kawaipay-events:link', now())`);
    expect(await estimateIndexerLagMs(pg)).toBeGreaterThan(55_000);
  });
});
