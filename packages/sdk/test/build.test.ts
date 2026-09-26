// @vitest-environment node
// esbuild patches/inspects globals (TextEncoder etc.) in ways that conflict with jsdom's
// versions of the same globals — this test needs the real Node environment, not jsdom.
import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZE_BUDGET_BYTES = 6 * 1024; // spec section 6: "size budget under 6 KB gzipped"

describe("production bundle", () => {
  it("builds as a single IIFE and stays under the 6KB gzipped budget", async () => {
    const result = await build({
      entryPoints: [join(__dirname, "../src/bootstrap.ts")],
      bundle: true,
      minify: true,
      format: "iife",
      target: ["es2020"],
      legalComments: "none",
      write: false,
    });

    expect(result.outputFiles).toHaveLength(1);
    const bytes = Buffer.from(result.outputFiles[0]!.contents);
    const gzipped = gzipSync(bytes, { level: 9 });

    expect(gzipped.length).toBeLessThan(SIZE_BUDGET_BYTES);
    // Sanity: this is meant to be dependency-free — no accidental multi-hundred-KB import slipped in.
    expect(bytes.length).toBeLessThan(50 * 1024);
  });
});
