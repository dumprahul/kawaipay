import { describe, expect, it } from "vitest";
import { buildSettleTransaction, type SettleItem } from "../src/ptb.js";

const CONFIG = {
  packageId: "0x" + "aa".repeat(32),
  registryId: "0x" + "bb".repeat(32),
  usdcType: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
};

function item(overrides: Partial<SettleItem> = {}): SettleItem {
  return {
    campaignId: "0x" + "cc".repeat(32),
    linkId: "0x" + "dd".repeat(32),
    seq: 0,
    secondsVerified: 60,
    amount: 1000,
    logRoot: new Uint8Array(32).fill(1),
    expiresAtMs: 4102444800000,
    signature: new Uint8Array(64).fill(2),
    ...overrides,
  };
}

describe("buildSettleTransaction", () => {
  it("builds one moveCall command per item, targeting payout::settle", () => {
    const tx = buildSettleTransaction([item(), item({ seq: 1 })], CONFIG);
    const data = tx.getData();
    const moveCalls = data.commands.filter((c: { $kind: string }) => c.$kind === "MoveCall");
    expect(moveCalls).toHaveLength(2);
    for (const call of moveCalls as Array<{ MoveCall: { package: string; module: string; function: string; typeArguments: string[] } }>) {
      expect(call.MoveCall.package).toBe(CONFIG.packageId);
      expect(call.MoveCall.module).toBe("payout");
      expect(call.MoveCall.function).toBe("settle");
      expect(call.MoveCall.typeArguments).toEqual([CONFIG.usdcType]);
    }
  });

  it("passes 10 arguments per call, matching payout::settle's signature", () => {
    const tx = buildSettleTransaction([item()], CONFIG);
    const data = tx.getData();
    const moveCall = data.commands.find((c: { $kind: string }) => c.$kind === "MoveCall") as { MoveCall: { arguments: unknown[] } };
    expect(moveCall.MoveCall.arguments).toHaveLength(10);
  });

  it("builds an empty transaction (no commands) for an empty item list", () => {
    const tx = buildSettleTransaction([], CONFIG);
    expect(tx.getData().commands).toHaveLength(0);
  });

  it("is deterministic: the same items always produce the same command structure", () => {
    const items = [item(), item({ seq: 1, amount: 500 })];
    const a = buildSettleTransaction(items, CONFIG).getData();
    const b = buildSettleTransaction(items, CONFIG).getData();
    expect(a.commands).toEqual(b.commands);
  });
});
