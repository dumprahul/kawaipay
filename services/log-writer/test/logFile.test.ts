import { describe, expect, it } from "vitest";
import { buildLogFile, headerFor, logKey, parseLogFile } from "../src/logFile.js";

describe("logKey", () => {
  it("is stable per (link, seq)", () => {
    expect(logKey("0xlink", 5)).toBe("logs/0xlink/5.jsonl");
  });
});

describe("buildLogFile / parseLogFile", () => {
  it("round-trips a header and records, and is deterministic", () => {
    const root = new Uint8Array(32).fill(7);
    const header = headerFor("0xlink", "0xcampaign", 5, root, "1.0.0");
    const records = ['{"a":1}', '{"a":2}'];

    const bytes1 = buildLogFile(header, records);
    const bytes2 = buildLogFile(header, records);
    expect(Buffer.from(bytes1)).toEqual(Buffer.from(bytes2));

    const parsed = parseLogFile(bytes1);
    expect(parsed.header).toEqual({
      v: 1,
      kind: "kawaipay-tick-log",
      link_id: "0xlink",
      campaign_id: "0xcampaign",
      seq: 5,
      leaf_count: 2,
      root: header.root,
      scorer_version: "1.0.0",
    });
    expect(parsed.canonicalRecordJsons).toEqual(records);
  });

  it("rejects an empty file", () => {
    expect(() => parseLogFile(new Uint8Array())).toThrow(/empty log file/);
  });
});
