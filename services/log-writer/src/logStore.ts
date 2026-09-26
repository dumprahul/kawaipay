import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Where a confirmed batch item's tick log gets uploaded (spec section 11). `key` is a
 * stable, human-readable path (`logs/{link_id}/{seq}.jsonl`); the store returns whatever
 * opaque `blobId` it wants recorded in `batch_items.log_blob_id` — for a content-addressed
 * backend (e.g. Walrus) that need not equal `key`.
 */
export interface LogStore {
  put(key: string, bytes: Uint8Array): Promise<{ blobId: string }>;
  get(blobId: string): Promise<Uint8Array>;
}

/** Development store: writes under a local directory, keyed by the log's own path. */
export class LocalFsStore implements LogStore {
  constructor(private readonly baseDir: string) {}

  async put(key: string, bytes: Uint8Array): Promise<{ blobId: string }> {
    const path = join(this.baseDir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    return { blobId: key };
  }

  async get(blobId: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(join(this.baseDir, blobId)));
  }
}
