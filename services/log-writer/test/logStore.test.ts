import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalFsStore } from "../src/logStore.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kawaipay-logstore-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("LocalFsStore", () => {
  it("writes bytes under the key, creating parent directories, and reads them back by blobId", async () => {
    const store = new LocalFsStore(dir);
    const bytes = new TextEncoder().encode("hello log");
    const { blobId } = await store.put("logs/0xlink/5.jsonl", bytes);
    expect(blobId).toBe("logs/0xlink/5.jsonl");

    const readBack = await store.get(blobId);
    expect(Buffer.from(readBack)).toEqual(Buffer.from(bytes));
  });
});
