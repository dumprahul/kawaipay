import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config as dotenvConfig } from "dotenv";

/**
 * Loads the monorepo's root `.env` into `process.env`, regardless of which service
 * directory the process was actually started from (pnpm's `--filter` runs a package's
 * scripts with that package's own directory as cwd, not the repo root). Walks upward
 * from `process.cwd()` looking for a `.env` file — there's only ever meant to be one,
 * at the repo root, shared across every service for local dev. A production deploy
 * (Railway, etc.) sets real environment variables directly and has no `.env` file to
 * find, so this is a silent no-op there.
 */
export function loadEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      dotenvConfig({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
