/**
 * Retries `fn` with exponential backoff, doubling from `baseDelayMs` up to `maxDelayMs`,
 * for `maxAttempts` tries total. The 24-hour ceiling in spec section 11 is enforced by
 * the outer poll loop re-attempting on every cycle (an item with no log_blob_id is always
 * a candidate again), not by one call blocking that long — this bounds a single call to a
 * handful of quick retries so a transient store error doesn't stall the whole batch.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; baseDelayMs: number; maxDelayMs: number; sleep?: (ms: number) => Promise<void> },
): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastErr: unknown;
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < opts.maxAttempts - 1) {
        const delay = Math.min(opts.baseDelayMs * 2 ** attempt, opts.maxDelayMs);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}
