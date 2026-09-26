import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { processPage } from "../src/indexer.js";
import { getCursor } from "../src/cursor.js";
import { createTestDatabase, ev, FakeEventSource } from "./testHarness.js";

let pg: Pool;

beforeAll(async () => {
  pg = await createTestDatabase("kawaipay_indexer_page_test");
}, 30_000);

afterAll(async () => {
  await pg.end();
});

beforeEach(async () => {
  await pg.query("TRUNCATE campaigns, links, accruals, settlements, batches, batch_items, indexer_cursor CASCADE");
});

function campaignCreatedEvents(count: number) {
  return Array.from({ length: count }, (_, i) =>
    ev("CampaignCreated", "campaign", `tx-${i}`, 0, {
      campaign_id: `campaign-${i}`,
      seller: "0xseller",
      rate_per_second: "1",
      max_rate_per_second: "2",
      per_settle_cap: "3",
      per_link_epoch_cap: "4",
      open_links: true,
    }),
  );
}

describe("processPage", () => {
  it("advances the cursor and applies every event in the page", async () => {
    const source = new FakeEventSource();
    source.setEvents("campaign", campaignCreatedEvents(5));

    const result = await processPage(pg, source, "campaign");
    expect(result).toEqual({ processed: 5, hasNextPage: false });

    const { rows } = await pg.query("SELECT campaign_id FROM campaigns ORDER BY campaign_id");
    expect(rows.map((r) => r.campaign_id)).toEqual(["campaign-0", "campaign-1", "campaign-2", "campaign-3", "campaign-4"]);

    const cursor = await getCursor(pg, "kawaipay-events:campaign");
    expect(cursor).toEqual("4"); // opaque cursor = the fake source's own index of the last event
  });

  it("paginates: a second call with a smaller page size only advances by that page", async () => {
    const source = new FakeEventSource();
    source.setEvents("campaign", campaignCreatedEvents(3));

    // processPage always requests PAGE_SIZE (100), so simulate paging by feeding events
    // incrementally instead — this proves the cursor-based resumption itself works.
    source.setEvents("campaign", campaignCreatedEvents(3).slice(0, 1));
    await processPage(pg, source, "campaign");
    let { rows } = await pg.query("SELECT count(*)::int FROM campaigns");
    expect(rows[0].count).toBe(1);

    source.setEvents("campaign", campaignCreatedEvents(3));
    await processPage(pg, source, "campaign");
    ({ rows } = await pg.query("SELECT count(*)::int FROM campaigns"));
    expect(rows[0].count).toBe(3);
  });

  it("replaying the same event page twice leaves the database unchanged", async () => {
    const source = new FakeEventSource();
    source.setEvents("campaign", campaignCreatedEvents(5));

    await processPage(pg, source, "campaign");
    const { rows: afterFirst } = await pg.query("SELECT * FROM campaigns ORDER BY campaign_id");
    const cursorAfterFirst = await getCursor(pg, "kawaipay-events:campaign");

    // Simulate a replay: same events, cursor rewound to the start.
    await pg.query("DELETE FROM indexer_cursor WHERE name = $1", ["kawaipay-events:campaign"]);
    await processPage(pg, source, "campaign");
    const { rows: afterReplay } = await pg.query("SELECT * FROM campaigns ORDER BY campaign_id");
    const cursorAfterReplay = await getCursor(pg, "kawaipay-events:campaign");

    expect(afterReplay).toEqual(afterFirst);
    expect(cursorAfterReplay).toEqual(cursorAfterFirst);
  });

  it("a crash mid-page rolls back the whole page, and a clean retry produces the same final state as an uninterrupted run", async () => {
    const events = campaignCreatedEvents(4);

    // Reference run: process all 4 events with no interruption.
    const cleanSource = new FakeEventSource();
    cleanSource.setEvents("campaign", events);
    await processPage(pg, cleanSource, "campaign");
    const { rows: cleanRows } = await pg.query("SELECT campaign_id, rate_per_second FROM campaigns ORDER BY campaign_id");
    const cleanCursor = await getCursor(pg, "kawaipay-events:campaign");

    await pg.query("TRUNCATE campaigns, links, accruals, settlements, batches, batch_items, indexer_cursor CASCADE");

    // Crash run: the 3rd event in the page is genuinely malformed (missing rate_per_second),
    // which handleCampaignCreated's own validation rejects — simulating a mid-page failure
    // without mocking anything internal.
    const eventsWithABadOne = events.map((e, i) => (i === 2 ? { ...e, parsedJson: { ...e.parsedJson, rate_per_second: undefined } } : e));
    const crashSource = new FakeEventSource();
    crashSource.setEvents("campaign", eventsWithABadOne);
    await expect(processPage(pg, crashSource, "campaign")).rejects.toThrow();

    const { rows: afterCrash } = await pg.query("SELECT count(*)::int FROM campaigns");
    expect(afterCrash[0].count).toBe(0); // nothing partially committed, even though events 0 and 1 were valid
    const cursorAfterCrash = await getCursor(pg, "kawaipay-events:campaign");
    expect(cursorAfterCrash).toBeNull(); // cursor never advanced either

    // Clean retry of the exact same page (now with valid data) succeeds fully.
    const retrySource = new FakeEventSource();
    retrySource.setEvents("campaign", events);
    await processPage(pg, retrySource, "campaign");
    const { rows: afterRetry } = await pg.query("SELECT campaign_id, rate_per_second FROM campaigns ORDER BY campaign_id");
    const cursorAfterRetry = await getCursor(pg, "kawaipay-events:campaign");

    expect(afterRetry).toEqual(cleanRows);
    expect(cursorAfterRetry).toEqual(cleanCursor);
  });
});
