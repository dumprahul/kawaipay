/**
 * Races a promise against a hard deadline. Without this, a page's loading state has no
 * way to distinguish "still working" from "silently stuck forever" — if the awaited
 * promise never settles (a hung network call, a stalled browser API), the UI would spin
 * indefinitely with nothing to show the user and nothing to retry.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}
