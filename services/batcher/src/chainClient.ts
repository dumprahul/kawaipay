import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Transaction } from "@mysten/sui/transactions";

export interface TxOutcome {
  digest: string;
  success: boolean;
  /** The Move abort code as a string, when the failure was a MoveAbort. */
  abortCode: string | null;
  error: string | null;
}

/**
 * Everything the batcher needs from Sui, kept behind one interface for the same reason
 * as the indexer's EventSource (spec section 9's design principle applies here too):
 * verified directly against @mysten/sui's real, working `SuiGraphQLClient.core` methods
 * (`simulateTransaction`, `signAndExecuteTransaction`, `getTransaction`) — the JSON-RPC
 * equivalents this spec's example code was written against are already fully
 * decommissioned on public full nodes (see services/indexer's eventSource.ts for the
 * full story). `getTransaction` throwing "not found" for a missing digest — verified
 * live against testnet — is the exact signal the unknown-outcome resolver depends on.
 */
export interface ChainClient {
  readonly relayerAddress: string;
  simulate(tx: Transaction): Promise<TxOutcome>;
  signAndSubmit(tx: Transaction): Promise<TxOutcome>;
  /** null means "definitely not found on chain" (a real TransactionError from getTransaction). */
  getTransactionOutcome(digest: string): Promise<TxOutcome | null>;
  getSuiBalance(address: string): Promise<number>;
}

function extractAbortCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const moveAbort = (error as { MoveAbort?: { abortCode?: string } }).MoveAbort;
  return moveAbort?.abortCode ?? null;
}

function extractErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

export class SuiGraphQLChainClient implements ChainClient {
  private readonly client: SuiGraphQLClient;
  private readonly keypair: Ed25519Keypair;
  readonly relayerAddress: string;

  constructor(graphqlUrl: string, network: string, relayerSecretKeyHex: string) {
    this.client = new SuiGraphQLClient({ url: graphqlUrl, network });
    this.keypair = Ed25519Keypair.fromSecretKey(Buffer.from(relayerSecretKeyHex, "hex"));
    this.relayerAddress = this.keypair.toSuiAddress();
  }

  async simulate(tx: Transaction): Promise<TxOutcome> {
    tx.setSenderIfNotSet(this.relayerAddress);
    const result = await this.client.core.simulateTransaction({ transaction: tx });
    const inner = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
    return {
      digest: inner.digest,
      success: inner.status.success,
      abortCode: inner.status.success ? null : extractAbortCode(inner.status.error),
      error: inner.status.success ? null : extractErrorMessage(inner.status.error),
    };
  }

  async signAndSubmit(tx: Transaction): Promise<TxOutcome> {
    tx.setSenderIfNotSet(this.relayerAddress);
    const result = await this.client.core.signAndExecuteTransaction({ transaction: tx, signer: this.keypair });
    const inner = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
    return {
      digest: inner.digest,
      success: inner.status.success,
      abortCode: inner.status.success ? null : extractAbortCode(inner.status.error),
      error: inner.status.success ? null : extractErrorMessage(inner.status.error),
    };
  }

  async getTransactionOutcome(digest: string): Promise<TxOutcome | null> {
    try {
      const result = await this.client.core.getTransaction({ digest });
      const inner = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
      return {
        digest: inner.digest,
        success: inner.status.success,
        abortCode: inner.status.success ? null : extractAbortCode(inner.status.error),
        error: inner.status.success ? null : extractErrorMessage(inner.status.error),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not found")) return null;
      throw err;
    }
  }

  async getSuiBalance(address: string): Promise<number> {
    const result = await this.client.core.getBalance({ owner: address, coinType: "0x2::sui::SUI" });
    return Number(result.balance.balance);
  }
}
