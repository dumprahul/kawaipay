import type { Pool, PoolClient } from "pg";
import type { EventCursor } from "./eventSource.js";

export const KAWAIPAY_EVENTS_CURSOR_PREFIX = "kawaipay-events";

export function cursorName(module: string): string {
  return `${KAWAIPAY_EVENTS_CURSOR_PREFIX}:${module}`;
}

export async function getCursor(pg: Pool, name: string): Promise<EventCursor | null> {
  const { rows } = await pg.query(`SELECT cursor FROM indexer_cursor WHERE name = $1`, [name]);
  return rows[0]?.cursor ?? null;
}

/** Must be called within the same transaction as the writes it's paired with (spec section 9). */
export async function setCursorInTx(client: PoolClient, name: string, cursor: EventCursor): Promise<void> {
  await client.query(
    `INSERT INTO indexer_cursor (name, cursor) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET cursor = EXCLUDED.cursor`,
    [name, JSON.stringify(cursor)],
  );
}
