import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeLogRoot } from "../src/merkle.js";
import { bytesToHex } from "../src/bcs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(readFileSync(join(__dirname, "../testvectors/merkle.json"), "utf8"));

describe("computeLogRoot (RFC 6962 style) against independently-computed vectors", () => {
  for (const n of [1, 2, 3, 5, 8]) {
    it(`matches the pinned root for ${n} leaves`, () => {
      const { records, rootHex } = vectors[`leaves_${n}`];
      expect(bytesToHex(computeLogRoot(records))).toBe(rootHex);
    });
  }

  it("throws on an empty leaf set (a batch item always has at least one record)", () => {
    expect(() => computeLogRoot([])).toThrow();
  });

  it("is sensitive to leaf order (not order-independent)", () => {
    const a = computeLogRoot(['{"record":0}', '{"record":1}']);
    const b = computeLogRoot(['{"record":1}', '{"record":0}']);
    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
  });
});
