import { Transaction } from "@mysten/sui/transactions";
import { suiClient, buildZkLoginSignature, type ZkLoginSession } from "./zklogin";

// Matches the real, deployed kawaipay package (services/batcher's PACKAGE_ID/USDC_TYPE).
export const PACKAGE_ID = "0x783ffc3f10c07ed01ba7799b92f2bbd663c1b2bbe3ac574dc03598e2f6a93e03";
export const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

// Sensible campaign defaults for a listing created from the storefront UI — the seller
// only chooses title/price/escrow; these govern the oracle's payout ceilings per spec.
const DEFAULT_MAX_RATE_MULTIPLIER = 10; // max_rate_per_second allows up to 10x the base rate as headroom
const DEFAULT_PER_SETTLE_CAP_DIVISOR = 2; // a single settlement can use at most half the escrow

export class InsufficientFundsError extends Error {
  constructor(
    public readonly asset: "USDC" | "SUI",
    public readonly needed: number,
    public readonly have: number,
  ) {
    super(`Insufficient ${asset}: need ${needed}, wallet has ${have}. Fund your wallet (${asset === "SUI" ? "gas" : "escrow"}) and try again.`);
  }
}

async function getUsdcBalance(address: string): Promise<{ totalBaseUnits: number; coinObjectIds: string[] }> {
  const { objects } = await suiClient.core.listCoins({ owner: address, coinType: USDC_TYPE });
  let total = 0;
  const ids: string[] = [];
  for (const coin of objects) {
    total += Number(coin.balance ?? 0);
    ids.push(coin.objectId);
  }
  return { totalBaseUnits: total, coinObjectIds: ids };
}

export interface CreateCampaignParams {
  ratePerSecondBaseUnits: number; // reward paid per second of verified attention, USDC base units (6 decimals)
  escrowBaseUnits: number; // total USDC to deposit into the campaign's escrow
}

export interface CreateCampaignResult {
  digest: string;
  campaignId: string;
  campaignCapId: string;
}

/**
 * Real on-chain campaign::create, signed by the seller's zkLogin session. Splits the
 * requested escrow amount off the seller's own USDC coin(s) — a brand-new zkLogin wallet
 * has zero USDC by design (it's a fresh keypair-derived address), so this throws a clear
 * InsufficientFundsError rather than failing with an opaque chain error if there's
 * nothing to split from.
 */
export async function createCampaignOnChain(session: ZkLoginSession, params: CreateCampaignParams): Promise<CreateCampaignResult> {
  const { totalBaseUnits, coinObjectIds } = await getUsdcBalance(session.address);
  if (totalBaseUnits < params.escrowBaseUnits || coinObjectIds.length === 0) {
    throw new InsufficientFundsError("USDC", params.escrowBaseUnits, totalBaseUnits);
  }

  const tx = new Transaction();
  tx.setSender(session.address);

  const [primary, ...rest] = coinObjectIds;
  if (rest.length > 0) {
    tx.mergeCoins(
      tx.object(primary!),
      rest.map((id) => tx.object(id)),
    );
  }
  const [deposit] = tx.splitCoins(tx.object(primary!), [params.escrowBaseUnits]);

  const [cap] = tx.moveCall({
    target: `${PACKAGE_ID}::campaign::create`,
    typeArguments: [USDC_TYPE],
    arguments: [
      deposit,
      tx.pure.u64(params.ratePerSecondBaseUnits),
      tx.pure.u64(params.ratePerSecondBaseUnits * DEFAULT_MAX_RATE_MULTIPLIER),
      tx.pure.u64(Math.floor(params.escrowBaseUnits / DEFAULT_PER_SETTLE_CAP_DIVISOR)),
      tx.pure.u64(params.escrowBaseUnits),
      tx.pure.bool(true), // open_links: anyone can create a shareable link for this campaign
    ],
  });
  tx.transferObjects([cap!], session.address);

  const bytes = await tx.build({ client: suiClient });
  const signature = await buildZkLoginSignature(session, bytes);
  const result = await suiClient.core.executeTransaction({
    transaction: bytes,
    signatures: [signature],
    include: { effects: true, objectTypes: true },
  });

  const executed = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
  if (!executed.status.success) {
    throw new Error(`campaign::create failed on-chain: ${JSON.stringify(executed.status.error)}`);
  }

  const campaignId = findCreatedObjectId(executed, `${PACKAGE_ID}::campaign::Campaign<${USDC_TYPE}>`);
  const campaignCapId = findCreatedObjectId(executed, `${PACKAGE_ID}::campaign::CampaignCap`);
  if (!campaignId || !campaignCapId) {
    throw new Error("campaign::create succeeded but the expected created objects were not found in its effects");
  }

  return { digest: executed.digest, campaignId, campaignCapId };
}

export interface CreateLinkResult {
  digest: string;
  linkId: string;
}

/** Real on-chain link::create — permissionless (campaign must have open_links: true, which every campaign created above sets). */
export async function createLinkOnChain(session: ZkLoginSession, campaignId: string): Promise<CreateLinkResult> {
  const tx = new Transaction();
  tx.setSender(session.address);
  tx.moveCall({
    target: `${PACKAGE_ID}::link::create`,
    typeArguments: [USDC_TYPE],
    arguments: [tx.object(campaignId)],
  });

  const bytes = await tx.build({ client: suiClient });
  const signature = await buildZkLoginSignature(session, bytes);
  const result = await suiClient.core.executeTransaction({
    transaction: bytes,
    signatures: [signature],
    include: { effects: true, objectTypes: true },
  });

  const executed = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
  if (!executed.status.success) {
    throw new Error(`link::create failed on-chain: ${JSON.stringify(executed.status.error)}`);
  }

  const linkId = findCreatedObjectId(executed, `${PACKAGE_ID}::link::Link<${USDC_TYPE}>`);
  if (!linkId) {
    throw new Error("link::create succeeded but the expected created Link object was not found in its effects");
  }

  return { digest: executed.digest, linkId };
}

/** Finds the object ID of a newly-created object matching `objectType`, from a transaction's effects + objectTypes map. */
function findCreatedObjectId(
  executed: { effects?: { changedObjects: { objectId: string; idOperation: string }[] }; objectTypes?: Record<string, string> },
  objectType: string,
): string | null {
  const changed = executed.effects?.changedObjects ?? [];
  const types = executed.objectTypes ?? {};
  for (const obj of changed) {
    if (obj.idOperation === "Created" && types[obj.objectId] === objectType) return obj.objectId;
  }
  return null;
}
