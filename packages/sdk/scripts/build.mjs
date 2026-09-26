import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outfile = join(__dirname, "../dist/sdk.js");
const SIZE_BUDGET_BYTES = 6 * 1024; // spec section 6: "under 6 KB gzipped"

await build({
  entryPoints: [join(__dirname, "../src/bootstrap.ts")],
  outfile,
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  legalComments: "none",
});

const bytes = readFileSync(outfile);
const gzipped = gzipSync(bytes, { level: 9 });

console.log(`sdk.js: ${bytes.length} bytes raw, ${gzipped.length} bytes gzipped (budget: ${SIZE_BUDGET_BYTES})`);

if (gzipped.length > SIZE_BUDGET_BYTES) {
  console.error(`FAIL: sdk.js is ${gzipped.length - SIZE_BUDGET_BYTES} bytes over the 6KB gzipped budget.`);
  process.exit(1);
}
console.log("PASS: within the 6KB gzipped budget.");
