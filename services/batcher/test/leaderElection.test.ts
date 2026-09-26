import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { releaseLeader, tryAcquireLeader } from "../src/leaderElection.js";
import { createTestDatabase } from "./testHarness.js";

let pg: Pool;
const LOCK_KEY = 5551234; // distinct from the production key so tests don't collide with a real instance

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_batcher_leader_election_test");
}, 30_000);

afterAll(async () => {
  await pg.end();
});

describe("leader election via a real Postgres advisory lock", () => {
  it("a second instance cannot acquire the lock while the first holds it, and can once released", async () => {
    const first = await tryAcquireLeader(pg, LOCK_KEY);
    expect(first).not.toBeNull();

    const second = await tryAcquireLeader(pg, LOCK_KEY);
    expect(second).toBeNull(); // busy

    await releaseLeader(first!, LOCK_KEY);

    const third = await tryAcquireLeader(pg, LOCK_KEY);
    expect(third).not.toBeNull();
    await releaseLeader(third!, LOCK_KEY);
  });

  it("different lock keys don't contend with each other", async () => {
    const a = await tryAcquireLeader(pg, LOCK_KEY + 1);
    const b = await tryAcquireLeader(pg, LOCK_KEY + 2);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    await releaseLeader(a!, LOCK_KEY + 1);
    await releaseLeader(b!, LOCK_KEY + 2);
  });
});
