import { Transaction } from "@mysten/sui/transactions";

export interface SettleItem {
  campaignId: string;
  linkId: string;
  seq: number;
  secondsVerified: number;
  amount: number;
  logRoot: Uint8Array;
  expiresAtMs: number;
  signature: Uint8Array;
}

export interface PtbConfig {
  packageId: string;
  registryId: string;
  usdcType: string;
}

/**
 * One Programmable Transaction Block with one payout::settle call per item (spec section
 * 8). Sui object versions are resolved at simulate/execute time from the object IDs, so
 * the same items always build to an equivalent transaction — this function has no
 * network dependency, which is what makes it unit-testable without a chain.
 */
export function buildSettleTransaction(items: SettleItem[], config: PtbConfig): Transaction {
  const tx = new Transaction();
  for (const item of items) {
    tx.moveCall({
      target: `${config.packageId}::payout::settle`,
      typeArguments: [config.usdcType],
      arguments: [
        tx.object(config.registryId),
        tx.object(item.campaignId),
        tx.object(item.linkId),
        tx.pure.u64(item.seq),
        tx.pure.u64(item.secondsVerified),
        tx.pure.u64(item.amount),
        tx.pure.vector("u8", item.logRoot),
        tx.pure.u64(item.expiresAtMs),
        tx.pure.vector("u8", item.signature),
        tx.object("0x6"),
      ],
    });
  }
  return tx;
}
