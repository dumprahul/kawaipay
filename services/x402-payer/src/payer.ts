import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import type { X402PayerConfig } from "./config.js";

interface PaymentRequirements {
  scheme: "exact";
  network: string; // e.g. "sui:testnet"
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

export type CycleOutcome =
  | { kind: "paid"; digest: string; payTo: string; amount: string; asset: string }
  | { kind: "insufficient_funds"; asset: string; needed: string; have: number }
  | { kind: "settle_rejected"; reason: string }
  | { kind: "error"; message: string };

const suiClientCache = new Map<string, SuiGraphQLClient>();

function suiClientFor(network: string): SuiGraphQLClient {
  const shortNetwork = network.split(":").pop() ?? "testnet";
  let client = suiClientCache.get(shortNetwork);
  if (!client) {
    client = new SuiGraphQLClient({ url: `https://graphql.${shortNetwork}.sui.io/graphql`, network: shortNetwork });
    suiClientCache.set(shortNetwork, client);
  }
  return client;
}

/**
 * One full x402 client round-trip against oracle-api's x402-gated verdict endpoint,
 * exactly the real protocol a paying third party would follow: discover the price via
 * the 402 response, build+sign a real on-chain payment transaction for exactly what it
 * asks for, retry with X-PAYMENT — no hardcoded price/asset/payTo on this side, so it
 * always pays whatever oracle-api is actually configured to charge (including PAY_TO,
 * whatever address that's set to in its own Railway env).
 */
export async function runPaymentCycle(config: X402PayerConfig, keypair: Ed25519Keypair): Promise<CycleOutcome> {
  const address = keypair.toSuiAddress();
  const demoBody = {
    ticks: [
      {
        gapMs: 5000,
        stats: {
          windowMs: 5000, visibleMs: 5000, focusedMs: 5000, inViewportMs: 5000,
          contentViewportRatio: 1, scrollEvents: 3, scrollDepthPct: 40, scrollSpeedMax: 500,
          pointerMoves: 10, pointerCells: 10, touchEvents: 0, keyEvents: 0, tabSwitches: 0,
        },
      },
    ],
    ipClass: "residential" as const,
  };

  const discovery = await fetch(`${config.oracleApiUrl}/v1/oracle/verdict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(demoBody),
  });
  if (discovery.status !== 402) {
    return { kind: "error", message: `expected 402 payment_required on first call, got ${discovery.status}` };
  }
  const { accepts } = (await discovery.json()) as { accepts: PaymentRequirements[] };
  const requirements = accepts[0];
  if (!requirements) {
    return { kind: "error", message: "402 response had no accepted payment requirements" };
  }

  const client = suiClientFor(requirements.network);
  const { objects: coins } = await client.core.listCoins({ owner: address, coinType: requirements.asset });
  const total = coins.reduce((sum, c) => sum + Number(c.balance ?? 0), 0);
  const needed = Number(requirements.amount);
  if (total < needed || coins.length === 0) {
    return { kind: "insufficient_funds", asset: requirements.asset, needed: requirements.amount, have: total };
  }

  const tx = new Transaction();
  tx.setSender(address);
  const [primary, ...rest] = coins;
  if (rest.length > 0) {
    tx.mergeCoins(tx.object(primary!.objectId), rest.map((c) => tx.object(c.objectId)));
  }
  const [payment] = tx.splitCoins(tx.object(primary!.objectId), [needed]);
  tx.transferObjects([payment!], requirements.payTo);

  const bytes = await tx.build({ client });
  const { signature } = await keypair.signTransaction(bytes);

  const paymentPayload = {
    x402Version: 2,
    accepted: requirements,
    payload: { transaction: toBase64(bytes), signature },
  };
  const paymentHeader = Buffer.from(JSON.stringify(paymentPayload), "utf8").toString("base64");

  const settleRes = await fetch(`${config.oracleApiUrl}/v1/oracle/verdict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PAYMENT": paymentHeader },
    body: JSON.stringify(demoBody),
  });

  if (settleRes.status !== 200) {
    const body = await settleRes.text();
    return { kind: "settle_rejected", reason: `HTTP ${settleRes.status}: ${body}` };
  }

  const paymentResponseHeader = settleRes.headers.get("x-payment-response");
  const digest = paymentResponseHeader
    ? (JSON.parse(Buffer.from(paymentResponseHeader, "base64").toString("utf8")) as { transaction?: string }).transaction
    : undefined;

  return {
    kind: "paid",
    digest: digest ?? "unknown",
    payTo: requirements.payTo,
    amount: requirements.amount,
    asset: requirements.asset,
  };
}
