import type { Pool } from "pg";
import { INDEXER_POLL_MS } from "@kawaipay/shared";
import { cursorName, getCursor, setCursorInTx } from "./cursor.js";
import { dispatchEvent, type HandlerContext } from "./handlers.js";
import type { EventSource } from "./eventSource.js";
import { touchHeartbeat } from "./heartbeat.js";
import type { IndexerMetrics } from "./metrics.js";

// Spec section 9 assumed "page 100 events at a time," matching the old JSON-RPC default.
// Verified live against the real GraphQL endpoint (graphql.testnet.sui.io): it caps page
// size at 50 and returns a hard error above that, so 100 would break the indexer outright.
export const PAGE_SIZE = 50;

export interface ProcessPageResult {
  processed: number;
  hasNextPage: boolean;
}

/**
 * Fetches and applies one page of a module's events, storing the new cursor in the
 * SAME transaction as the writes (spec section 9). This is the actual idempotency
 * mechanism for most handlers: a crash before COMMIT rolls back every write in the
 * page, so a retry reprocesses the identical page from scratch — never a partial
 * double-application. PayoutSettled additionally guards itself via settlements' PK,
 * for safety that survives even a manually rewound cursor.
 */
export async function processPage(
  pg: Pool,
  eventSource: EventSource,
  module: string,
  log: (msg: string, meta?: Record<string, unknown>) => void = () => {},
): Promise<ProcessPageResult> {
  const name = cursorName(module);
  const cursor = await getCursor(pg, name);
  const page = await eventSource.queryModuleEvents(module, cursor, PAGE_SIZE);

  if (page.events.length === 0) {
    return { processed: 0, hasNextPage: false };
  }

  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    const ctx: HandlerContext = { client, eventSource, log };
    for (const event of page.events) {
      await dispatchEvent(ctx, event);
    }
    if (page.nextCursor) {
      await setCursorInTx(client, name, page.nextCursor);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { processed: page.events.length, hasNextPage: page.hasNextPage };
}

const MODULES = ["oracle_registry", "campaign", "link", "payout"] as const;

/** Polls one module forever: no sleep while pages are full, INDEXER_POLL_MS between empty polls. */
export async function runModuleLoop(
  pg: Pool,
  eventSource: EventSource,
  module: string,
  shouldContinue: () => boolean,
  log: (msg: string, meta?: Record<string, unknown>) => void = () => {},
  metrics?: IndexerMetrics,
): Promise<void> {
  while (shouldContinue()) {
    const result = await processPage(pg, eventSource, module, log);
    await touchHeartbeat(pg, cursorName(module));
    metrics?.pollsTotal.inc({ module });
    if (result.processed > 0) metrics?.eventsProcessed.inc({ module }, result.processed);
    if (!result.hasNextPage) {
      await new Promise((resolve) => setTimeout(resolve, INDEXER_POLL_MS));
    }
  }
}

export function startIndexer(
  pg: Pool,
  eventSource: EventSource,
  log?: (msg: string, meta?: Record<string, unknown>) => void,
  metrics?: IndexerMetrics,
) {
  let running = true;
  const loops = MODULES.map((m) => runModuleLoop(pg, eventSource, m, () => running, log, metrics));
  return {
    stop: () => {
      running = false;
    },
    done: Promise.all(loops).then(() => undefined),
  };
}
