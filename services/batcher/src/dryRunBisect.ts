import type { ChainClient } from "./chainClient.js";
import type { PtbConfig, SettleItem } from "./ptb.js";
import { buildSettleTransaction } from "./ptb.js";

export interface BisectResult<T> {
  succeeded: T[];
  failed: { item: T; error: string }[];
}

/**
 * Simulates the whole block; on failure, bisects to isolate exactly which item(s) are
 * bad, dropping them and keeping the rest (spec section 8, step 5). Safe to recombine
 * two independently-succeeding halves without a final joint re-simulation: settle()
 * takes the Campaign by immutable reference and mutates only its own Link, so items for
 * different links never interact within the same PTB.
 */
export async function dryRunAndBisect<T extends SettleItem>(
  chain: ChainClient,
  items: T[],
  ptbConfig: PtbConfig,
): Promise<BisectResult<T>> {
  if (items.length === 0) {
    return { succeeded: [], failed: [] };
  }

  const outcome = await chain.simulate(buildSettleTransaction(items, ptbConfig));
  if (outcome.success) {
    return { succeeded: items, failed: [] };
  }
  if (items.length === 1) {
    return { succeeded: [], failed: [{ item: items[0]!, error: outcome.error ?? "dry-run failed with no error detail" }] };
  }

  const mid = Math.floor(items.length / 2);
  const [left, right] = await Promise.all([
    dryRunAndBisect(chain, items.slice(0, mid), ptbConfig),
    dryRunAndBisect(chain, items.slice(mid), ptbConfig),
  ]);
  return {
    succeeded: [...left.succeeded, ...right.succeeded],
    failed: [...left.failed, ...right.failed],
  };
}
