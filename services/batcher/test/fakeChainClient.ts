import type { Transaction } from "@mysten/sui/transactions";
import type { ChainClient, TxOutcome } from "../src/chainClient.js";

/**
 * A fully controllable ChainClient for testing bisection, guards, and unknown-outcome
 * resolution without touching a real network. `failingLinkIds` lets a test declare
 * exactly which items should fail simulation, driving the bisection algorithm's
 * recursive splitting deterministically.
 */
export class FakeChainClient implements ChainClient {
  relayerAddress = "0xrelayer";
  suiBalance = 1_000_000_000;
  failingLinkIds = new Set<string>();
  simulateCallCount = 0;
  submitResult: TxOutcome | null = null;
  transactionOutcomes = new Map<string, TxOutcome | null>();

  private commandsOf(tx: Transaction): { MoveCall: { arguments: unknown[] } }[] {
    return tx.getData().commands.filter((c: { $kind: string }) => c.$kind === "MoveCall") as { MoveCall: { arguments: unknown[] } }[];
  }

  /** Object inputs are unresolved at build time (versions aren't fetched until simulate/execute),
   * so each shows up as {$kind: 'UnresolvedObject', UnresolvedObject: {objectId}} — verified
   * directly against @mysten/sui's actual output rather than assumed. */
  private objectIdsInTx(tx: Transaction): string[] {
    const data = tx.getData();
    return (data.inputs as { $kind: string; UnresolvedObject?: { objectId: string } }[])
      .filter((input) => input.$kind === "UnresolvedObject")
      .map((input) => input.UnresolvedObject!.objectId);
  }

  async simulate(tx: Transaction): Promise<TxOutcome> {
    this.simulateCallCount++;
    const objectIds = this.objectIdsInTx(tx);
    const failing = objectIds.find((id) => this.failingLinkIds.has(id));
    if (failing) {
      return { digest: "sim-digest", success: false, abortCode: "5", error: `simulated failure for ${failing}` };
    }
    return { digest: "sim-digest", success: true, abortCode: null, error: null };
  }

  async signAndSubmit(_tx: Transaction): Promise<TxOutcome> {
    return this.submitResult ?? { digest: "submit-digest", success: true, abortCode: null, error: null };
  }

  async getTransactionOutcome(digest: string): Promise<TxOutcome | null> {
    return this.transactionOutcomes.has(digest) ? this.transactionOutcomes.get(digest)! : null;
  }

  async getSuiBalance(_address: string): Promise<number> {
    return this.suiBalance;
  }
}
