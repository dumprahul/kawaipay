import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client, Pool } from "pg";
import type { EventCursor, EventPage, EventSource, RawEvent } from "../src/eventSource.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_URL = process.env.POSTGRES_ADMIN_URL ?? "postgres://localhost/postgres";

export async function createTestDatabase(dbName: string): Promise<Pool> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [dbName]);
  await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  const pool = new Pool({ connectionString: url.toString() });

  const migration = readFileSync(join(__dirname, "../../../db/migrations/0001_init.sql"), "utf8");
  await pool.query(migration);
  return pool;
}

/**
 * A fully in-memory, fully controllable EventSource for testing the indexer's page
 * processing, replay-safety and crash-recovery behavior without touching a real chain.
 * Cursors here are just stringified indices — opaque to everything except this fake,
 * exactly like the real transport's cursors are opaque to the indexer.
 */
export class FakeEventSource implements EventSource {
  private eventsByModule = new Map<string, RawEvent[]>();
  coinTypes = new Map<string, string>();

  setEvents(module: string, events: RawEvent[]) {
    this.eventsByModule.set(module, events);
  }

  async queryModuleEvents(module: string, cursor: EventCursor | null, limit: number): Promise<EventPage> {
    const all = this.eventsByModule.get(module) ?? [];
    const startIdx = cursor ? Number(cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + limit);
    const lastIdx = startIdx + slice.length - 1;
    const hasNextPage = startIdx + limit < all.length;
    return {
      events: slice,
      nextCursor: slice.length > 0 ? String(lastIdx) : null,
      hasNextPage,
    };
  }

  async getObjectCoinType(objectId: string): Promise<string | null> {
    return this.coinTypes.get(objectId) ?? "0x2::sui::SUI";
  }
}

export function ev(type: string, module: string, txDigest: string, eventIndex: number, parsedJson: Record<string, unknown>): RawEvent {
  return {
    type: `0xPKG::${module}::${type}`,
    module,
    parsedJson,
    txDigest,
    eventIndex,
    timestampMs: "1800000000000",
    checkpoint: 12345,
  };
}
