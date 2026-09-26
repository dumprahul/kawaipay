import { SuiGraphQLClient } from "@mysten/sui/graphql";

export interface OnChainSettlement {
  linkId: string;
  campaignId: string;
  seq: number;
  amount: number;
  secondsVerified: number;
  logRoot: Uint8Array;
}

function bytesFromJson(v: unknown): Uint8Array {
  if (typeof v === "string") return new Uint8Array(Buffer.from(v, "base64"));
  if (Array.isArray(v)) return new Uint8Array(v as number[]);
  throw new Error(`expected a byte array field, got ${JSON.stringify(v)}`);
}

/**
 * Fetches a specific PayoutSettled event straight from the chain, given the transaction
 * digest that settled it and the (link, seq) pair to disambiguate — a batch's one
 * transaction can carry a PayoutSettled event per link. This is the "outsider" half of
 * an audit (spec section 11): it needs no access to our Postgres, only a public GraphQL
 * endpoint and the digest, which any block explorer shows for a link's payouts.
 */
export async function fetchPayoutSettledEvent(
  graphqlUrl: string,
  network: string,
  txDigest: string,
  linkId: string,
  seq: number,
): Promise<OnChainSettlement | null> {
  const client = new SuiGraphQLClient({ url: graphqlUrl, network });
  const result = await client.core.getTransaction({ digest: txDigest, include: { events: true } });
  const tx = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
  for (const e of tx.events ?? []) {
    if (!e.eventType.endsWith("::payout::PayoutSettled")) continue;
    const p = e.json as Record<string, unknown>;
    if (p.link_id !== linkId || Number(p.seq) !== seq) continue;
    return {
      linkId: p.link_id as string,
      campaignId: p.campaign_id as string,
      seq: Number(p.seq),
      amount: Number(p.amount),
      secondsVerified: Number(p.seconds_verified),
      logRoot: bytesFromJson(p.log_root),
    };
  }
  return null;
}
