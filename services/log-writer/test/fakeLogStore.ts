import type { LogStore } from "../src/logStore.js";

/** In-memory LogStore test double that can be told to fail its first N put() calls. */
export class FakeLogStore implements LogStore {
  puts: { key: string; bytes: Uint8Array }[] = [];
  private readonly data = new Map<string, Uint8Array>();
  private failuresRemaining: number;

  constructor(opts: { failFirstNPuts?: number } = {}) {
    this.failuresRemaining = opts.failFirstNPuts ?? 0;
  }

  async put(key: string, bytes: Uint8Array): Promise<{ blobId: string }> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining--;
      throw new Error("simulated store outage");
    }
    this.puts.push({ key, bytes });
    this.data.set(key, bytes);
    return { blobId: key };
  }

  async get(blobId: string): Promise<Uint8Array> {
    const bytes = this.data.get(blobId);
    if (!bytes) throw new Error(`no such blob: ${blobId}`);
    return bytes;
  }
}
