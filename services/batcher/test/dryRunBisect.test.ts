import { describe, expect, it } from "vitest";
import { dryRunAndBisect } from "../src/dryRunBisect.js";
import type { SettleItem } from "../src/ptb.js";
import { FakeChainClient } from "./fakeChainClient.js";

const CONFIG = {
  packageId: "0x" + "aa".repeat(32),
  registryId: "0x" + "bb".repeat(32),
  usdcType: "0x2::sui::SUI",
};

function item(linkId: string): SettleItem {
  return {
    campaignId: "0x" + "cc".repeat(32),
    linkId,
    seq: 0,
    secondsVerified: 60,
    amount: 1000,
    logRoot: new Uint8Array(32).fill(1),
    expiresAtMs: 4102444800000,
    signature: new Uint8Array(64).fill(2),
  };
}

function linkId(n: number): string {
  return "0x" + n.toString(16).padStart(64, "0");
}

describe("dryRunAndBisect", () => {
  it("returns everything as succeeded when the whole block simulates fine", async () => {
    const chain = new FakeChainClient();
    const items = [item(linkId(1)), item(linkId(2)), item(linkId(3))];
    const result = await dryRunAndBisect(chain, items, CONFIG);
    expect(result.succeeded).toEqual(items);
    expect(result.failed).toEqual([]);
    expect(chain.simulateCallCount).toBe(1); // no bisection needed
  });

  it("isolates a single bad item among many good ones", async () => {
    const chain = new FakeChainClient();
    chain.failingLinkIds.add(linkId(2));
    const items = [item(linkId(1)), item(linkId(2)), item(linkId(3)), item(linkId(4))];

    const result = await dryRunAndBisect(chain, items, CONFIG);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.item.linkId).toBe(linkId(2));
    expect(result.succeeded.map((i) => i.linkId).sort()).toEqual([linkId(1), linkId(3), linkId(4)].sort());
  });

  it("isolates two bad items in different halves", async () => {
    const chain = new FakeChainClient();
    chain.failingLinkIds.add(linkId(1));
    chain.failingLinkIds.add(linkId(4));
    const items = [item(linkId(1)), item(linkId(2)), item(linkId(3)), item(linkId(4))];

    const result = await dryRunAndBisect(chain, items, CONFIG);
    expect(result.failed.map((f) => f.item.linkId).sort()).toEqual([linkId(1), linkId(4)].sort());
    expect(result.succeeded.map((i) => i.linkId).sort()).toEqual([linkId(2), linkId(3)].sort());
  });

  it("marks everything failed when every item is bad", async () => {
    const chain = new FakeChainClient();
    const items = [item(linkId(1)), item(linkId(2))];
    for (const it of items) chain.failingLinkIds.add(it.linkId);

    const result = await dryRunAndBisect(chain, items, CONFIG);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toHaveLength(2);
  });

  it("handles a single-item batch that fails, attaching the simulated error message", async () => {
    const chain = new FakeChainClient();
    chain.failingLinkIds.add(linkId(1));
    const result = await dryRunAndBisect(chain, [item(linkId(1))], CONFIG);
    expect(result.succeeded).toEqual([]);
    expect(result.failed[0]!.error).toContain(linkId(1));
  });

  it("returns immediately for an empty item list without calling simulate", async () => {
    const chain = new FakeChainClient();
    const result = await dryRunAndBisect(chain, [], CONFIG);
    expect(result).toEqual({ succeeded: [], failed: [] });
    expect(chain.simulateCallCount).toBe(0);
  });

  it("isolates the one bad item at the very end of a larger batch", async () => {
    const chain = new FakeChainClient();
    const items = Array.from({ length: 8 }, (_, i) => item(linkId(i + 1)));
    chain.failingLinkIds.add(linkId(8));

    const result = await dryRunAndBisect(chain, items, CONFIG);
    expect(result.failed.map((f) => f.item.linkId)).toEqual([linkId(8)]);
    expect(result.succeeded).toHaveLength(7);
  });
});
