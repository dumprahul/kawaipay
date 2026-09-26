import { Transaction } from "@mysten/sui/transactions";

/**
 * Fallback for a facilitator that doesn't echo `payer` in its /settle response: the
 * signed transaction's own sender field is authoritative (verified live: `Transaction.from`
 * decodes it straight from the transaction bytes the client actually signed).
 */
export function payerFromTransactionBytes(transactionBase64: string): string | undefined {
  try {
    return Transaction.from(transactionBase64).getData().sender ?? undefined;
  } catch {
    return undefined;
  }
}
