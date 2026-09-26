import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { loadConfig } from "./config.js";
import { runPaymentCycle } from "./payer.js";

/**
 * Continuously pays for oracle-api's x402-gated verdict endpoint — a real, recurring
 * on-chain payment on a fixed interval, not a one-off "does this pass" check. Every
 * cycle re-discovers the price/asset/payTo from oracle-api's own 402 response (so it
 * always tracks whatever PAY_TO is actually configured there) and settles for real.
 * See services/batcher/src/main.ts for the same "whole runtime as one callable function"
 * pattern this follows.
 */
export async function runX402PayerService(): Promise<void> {
  const config = loadConfig();
  const keypair = Ed25519Keypair.fromSecretKey(config.payerSecretKey);
  const address = keypair.toSuiAddress();
  const log = (msg: string, meta?: Record<string, unknown>) =>
    console.log(JSON.stringify({ msg, service: "x402-payer", payer: address, ...meta }));

  log("x402 payer started", { intervalMs: config.intervalMs, oracleApiUrl: config.oracleApiUrl });

  while (true) {
    try {
      const outcome = await runPaymentCycle(config, keypair);
      switch (outcome.kind) {
        case "paid":
          log("payment settled", { digest: outcome.digest, payTo: outcome.payTo, amount: outcome.amount, asset: outcome.asset });
          break;
        case "insufficient_funds":
          log("payer wallet out of funds — skipping this cycle", { asset: outcome.asset, needed: outcome.needed, have: outcome.have });
          break;
        case "settle_rejected":
          log("payment rejected by oracle-api", { reason: outcome.reason });
          break;
        case "error":
          log("cycle error", { message: outcome.message });
          break;
      }
    } catch (err) {
      log("cycle threw", { error: err instanceof Error ? err.message : String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, config.intervalMs));
  }
}
