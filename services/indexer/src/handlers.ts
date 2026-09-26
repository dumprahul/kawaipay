import type { PoolClient } from "pg";
import type { EventSource, RawEvent } from "./eventSource.js";

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  throw new Error(`expected a numeric field, got ${JSON.stringify(v)}`);
}

/**
 * Move's vector<u8> in an event's JSON representation: a base64 string on the GraphQL
 * transport (verified live — payout::settle's log_root arrived as e.g.
 * "uH2gmbRXjM5fPYTbmzkHBK2emQtMqks1iGNDgXO3ZjE=", not the array-of-numbers this code
 * originally assumed from JSON-RPC's parsedJson convention). Falls back to array form
 * defensively in case a future transport encodes it that way instead.
 */
function bytesFromJson(v: unknown): Buffer {
  if (typeof v === "string") return Buffer.from(v, "base64");
  if (Array.isArray(v)) return Buffer.from(v as number[]);
  throw new Error(`expected a byte array field, got ${JSON.stringify(v)}`);
}

export interface HandlerContext {
  client: PoolClient;
  eventSource: EventSource;
  log: (msg: string, meta?: Record<string, unknown>) => void;
}

async function handleCampaignCreated(ctx: HandlerContext, e: RawEvent): Promise<void> {
  const p = e.parsedJson;
  const campaignId = p.campaign_id as string;
  const coinType = (await ctx.eventSource.getObjectCoinType(campaignId)) ?? "unknown";
  await ctx.client.query(
    `INSERT INTO campaigns (campaign_id, seller, coin_type, rate_per_second, max_rate_per_second, per_settle_cap, per_link_epoch_cap, active, open_links)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
     ON CONFLICT (campaign_id) DO NOTHING`,
    [campaignId, p.seller, coinType, toNum(p.rate_per_second), toNum(p.max_rate_per_second), toNum(p.per_settle_cap), toNum(p.per_link_epoch_cap), p.open_links],
  );
}

async function handleCampaignUpdated(ctx: HandlerContext, e: RawEvent): Promise<void> {
  const p = e.parsedJson;
  await ctx.client.query(
    `UPDATE campaigns SET active = $2, rate_per_second = $3, max_rate_per_second = $4, per_settle_cap = $5, per_link_epoch_cap = $6
     WHERE campaign_id = $1`,
    [p.campaign_id, p.active, toNum(p.rate_per_second), toNum(p.max_rate_per_second), toNum(p.per_settle_cap), toNum(p.per_link_epoch_cap)],
  );
}

async function handleLinkCreated(ctx: HandlerContext, e: RawEvent): Promise<void> {
  const p = e.parsedJson;
  await ctx.client.query(
    `INSERT INTO links (link_id, campaign_id, creator, frozen, budget_remaining, next_seq)
     VALUES ($1, $2, $3, false, 0, 0) ON CONFLICT (link_id) DO NOTHING`,
    [p.link_id, p.campaign_id, p.creator],
  );
  await ctx.client.query(
    `INSERT INTO accruals (link_id, earned_total, settled_total) VALUES ($1, 0, 0) ON CONFLICT (link_id) DO NOTHING`,
    [p.link_id],
  );
}

async function handleLinkFunded(ctx: HandlerContext, e: RawEvent): Promise<void> {
  const p = e.parsedJson;
  await ctx.client.query(`UPDATE links SET budget_remaining = budget_remaining + $2 WHERE link_id = $1`, [p.link_id, toNum(p.amount)]);
}

async function handleLinkReclaimed(ctx: HandlerContext, e: RawEvent): Promise<void> {
  const p = e.parsedJson;
  await ctx.client.query(`UPDATE links SET budget_remaining = budget_remaining - $2 WHERE link_id = $1`, [p.link_id, toNum(p.amount)]);
}

async function handleLinkFrozen(ctx: HandlerContext, e: RawEvent): Promise<void> {
  await ctx.client.query(`UPDATE links SET frozen = true WHERE link_id = $1`, [e.parsedJson.link_id]);
}

async function handleLinkUnfrozen(ctx: HandlerContext, e: RawEvent): Promise<void> {
  await ctx.client.query(`UPDATE links SET frozen = false WHERE link_id = $1`, [e.parsedJson.link_id]);
}

async function handleSignerRotated(ctx: HandlerContext, e: RawEvent): Promise<void> {
  ctx.log("oracle signer rotated", { version: e.parsedJson.version });
}

/**
 * The one event with real idempotency logic beyond the per-page transaction boundary:
 * settlements' primary key (tx_digest, event_seq) guards against ever re-crediting the
 * same payout twice, even outside a crash-recovery replay (spec section 9's own note:
 * "what makes replays and overlapping reads harmless... keeps invariant 1 in section 4 true").
 */
async function handlePayoutSettled(ctx: HandlerContext, e: RawEvent): Promise<void> {
  const p = e.parsedJson;
  const linkId = p.link_id as string;
  const seq = toNum(p.seq);
  const amount = toNum(p.amount);
  const secondsVerified = toNum(p.seconds_verified);
  const logRoot = bytesFromJson(p.log_root);
  const checkpoint = e.checkpoint ?? 0;
  const timestampMs = p.timestamp_ms !== undefined ? toNum(p.timestamp_ms) : Number(e.timestampMs ?? 0);

  const inserted = await ctx.client.query(
    `INSERT INTO settlements (tx_digest, event_seq, link_id, seq, amount, seconds_verified, log_root, checkpoint, ts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9 / 1000.0))
     ON CONFLICT (tx_digest, event_seq) DO NOTHING`,
    [e.txDigest, e.eventIndex, linkId, seq, amount, secondsVerified, logRoot, checkpoint, timestampMs],
  );

  if (inserted.rowCount !== 1) {
    return; // already applied by an earlier pass over this exact event
  }

  await ctx.client.query(`UPDATE links SET next_seq = $2, budget_remaining = budget_remaining - $3, total_paid = total_paid + $3 WHERE link_id = $1`, [
    linkId,
    seq + 1,
    amount,
  ]);
  await ctx.client.query(`UPDATE accruals SET settled_total = settled_total + $2 WHERE link_id = $1`, [linkId, amount]);

  const { rows: allItemRows } = await ctx.client.query(`SELECT item_id, batch_id, status FROM batch_items WHERE link_id = $1 AND seq = $2`, [
    linkId,
    seq,
  ]);
  const anyItem = allItemRows[0];
  if (!anyItem) {
    // Genuinely no batch_items row at all for this (link, seq) — a settlement landed
    // that this indexer's own batcher never built, worth flagging for real.
    ctx.log("settlement with no matching batch_items row — submitted by something other than the batcher", { linkId, seq });
    return;
  }
  if (anyItem.status === "confirmed") {
    // Benign, expected race: the batcher already optimistically confirmed this item
    // itself right after a successful synchronous submit (spec section 8, step 7),
    // before this indexer pass got to the same event. Nothing left to do.
    return;
  }
  const item = anyItem;

  await ctx.client.query(`UPDATE batch_items SET status = 'confirmed' WHERE item_id = $1`, [item.item_id]);
  const { rows: remaining } = await ctx.client.query(`SELECT 1 FROM batch_items WHERE batch_id = $1 AND status != 'confirmed'`, [item.batch_id]);
  if (remaining.length === 0) {
    await ctx.client.query(`UPDATE batches SET status = 'confirmed', confirmed_at = now() WHERE batch_id = $1`, [item.batch_id]);
  }
}

const HANDLERS: Record<string, (ctx: HandlerContext, e: RawEvent) => Promise<void>> = {
  CampaignCreated: handleCampaignCreated,
  CampaignUpdated: handleCampaignUpdated,
  LinkCreated: handleLinkCreated,
  LinkFunded: handleLinkFunded,
  LinkReclaimed: handleLinkReclaimed,
  LinkFrozen: handleLinkFrozen,
  LinkUnfrozen: handleLinkUnfrozen,
  PayoutSettled: handlePayoutSettled,
  SignerRotated: handleSignerRotated,
};

export async function dispatchEvent(ctx: HandlerContext, e: RawEvent): Promise<void> {
  const structName = e.type.split("::").pop();
  const handler = structName ? HANDLERS[structName] : undefined;
  if (!handler) {
    ctx.log("no handler for event type", { type: e.type });
    return;
  }
  await handler(ctx, e);
}
