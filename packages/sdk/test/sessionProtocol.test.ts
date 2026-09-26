import { describe, expect, it, vi } from "vitest";
import { SessionRunner } from "../src/sessionProtocol.js";
import { StatsCollector } from "../src/stats.js";

interface FakeResponse {
  status: number;
  body: unknown;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

/** A fully controllable fake fetch + timer clock, so the 60s/12-heartbeat scenario runs instantly and deterministically. */
function makeHarness() {
  const requests: { url: string; body: unknown }[] = [];
  const responses: FakeResponse[] = [];
  let now = 0;
  let scheduled: (() => void | Promise<void>) | null = null;

  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    requests.push({ url, body });
    const next = responses.shift();
    if (!next) throw new Error("no fake response queued");
    return jsonResponse(next.status, next.body);
  });

  return {
    requests,
    queue(status: number, body: unknown) {
      responses.push({ status, body });
    },
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => now,
    advance(ms: number) {
      now += ms;
    },
    setTimer: (fn: () => void | Promise<void>) => {
      scheduled = fn;
      return 1;
    },
    clearTimer: () => {
      scheduled = null;
    },
    async fireScheduled() {
      const fn = scheduled;
      scheduled = null;
      if (fn) await fn();
    },
    hasScheduled: () => scheduled !== null,
  };
}

function sessionStartOk(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tracking: true,
    sessionId: "session-1",
    secret: Buffer.from(new Uint8Array(32)).toString("base64"),
    token: "token-0",
    heartbeatIntervalMs: 5000,
    sessionTtlMs: 15000,
    ...overrides,
  };
}

describe("SessionRunner — step 1: session start", () => {
  it("does nothing else when tracking is false", async () => {
    const h = makeHarness();
    h.queue(200, { tracking: false, reason: "LINK_FROZEN" });
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });

    await runner.start();

    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]!.url).toBe("https://host/v1/session/start");
    expect(h.hasScheduled()).toBe(false); // no heartbeat timer was ever set
  });

  it("schedules the first heartbeat when tracking is true", async () => {
    const h = makeHarness();
    h.queue(200, sessionStartOk());
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });

    await runner.start();
    expect(h.hasScheduled()).toBe(true);
  });
});

describe("SessionRunner — a scripted 60s session emits 12 heartbeats with strictly increasing seq", () => {
  it("sends exactly 12 heartbeats, seq 1..12, over 12 ticks", async () => {
    const h = makeHarness();
    h.queue(200, sessionStartOk());
    for (let i = 1; i <= 12; i++) {
      h.queue(200, { ok: true, nextSeq: i + 1, nextToken: `token-${i}` });
    }
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });

    await runner.start();
    const seqsSent: number[] = [];
    for (let i = 0; i < 12; i++) {
      h.advance(5000);
      await h.fireScheduled();
      const req = h.requests[h.requests.length - 1]!;
      seqsSent.push((req.body as { seq: number }).seq);
    }

    expect(seqsSent).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(h.requests).toHaveLength(13); // 1 session/start + 12 heartbeats
  });

  it("advances the token chain on every successful heartbeat", async () => {
    const h = makeHarness();
    h.queue(200, sessionStartOk({ token: "token-0" }));
    h.queue(200, { ok: true, nextSeq: 2, nextToken: "token-1" });
    h.queue(200, { ok: true, nextSeq: 3, nextToken: "token-2" });
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });

    await runner.start();
    h.advance(5000);
    await h.fireScheduled();
    expect((h.requests[1]!.body as { token: string }).token).toBe("token-0");

    h.advance(5000);
    await h.fireScheduled();
    expect((h.requests[2]!.body as { token: string }).token).toBe("token-1"); // the nextToken from the previous response
  });
});

describe("SessionRunner — MAC correctness", () => {
  it("computes a real, verifiable MAC over the exact stats sent", async () => {
    const h = makeHarness();
    h.queue(200, sessionStartOk());
    h.queue(200, { ok: true, nextSeq: 2, nextToken: "token-1" });
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });

    await runner.start();
    h.advance(5000);
    await h.fireScheduled();

    const req = h.requests[1]!.body as { sessionId: string; seq: number; token: string; stats: unknown; mac: string };
    const shared = await import("@kawaipay/shared");
    const expectedMac = shared.computeHeartbeatMac(
      Buffer.from(new Uint8Array(32)),
      shared.heartbeatMacMessage(req.sessionId, req.seq, req.token, req.stats as Record<string, unknown>),
    );
    expect(req.mac).toBe(expectedMac);
  });
});

describe("SessionRunner — step 5: network error / 5xx handling", () => {
  it("skips a tick on network failure, keeps state, and retries with a wider window next tick", async () => {
    const h = makeHarness();
    h.queue(200, sessionStartOk());
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });
    await runner.start();

    // No response queued for the next fetch call -> it throws (simulated network error).
    h.advance(5000);
    await h.fireScheduled();
    expect(h.hasScheduled()).toBe(true); // still scheduled a retry, did not stop

    h.queue(200, { ok: true, nextSeq: 2, nextToken: "token-1" });
    h.advance(5000); // total 10s elapsed since the last successful window
    await h.fireScheduled();
    const req = h.requests[h.requests.length - 1]!.body as { seq: number; token: string; stats: { windowMs: number } };
    expect(req.seq).toBe(1); // same seq as the failed attempt, not incremented again
    expect(req.token).toBe("token-0"); // same token
    expect(req.stats.windowMs).toBeGreaterThan(5000); // the skipped window's time is included
  });

  it("treats a 5xx the same as a network error", async () => {
    const h = makeHarness();
    h.queue(200, sessionStartOk());
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });
    await runner.start();

    h.queue(503, {});
    h.advance(5000);
    await h.fireScheduled();
    expect(h.hasScheduled()).toBe(true);
  });
});

describe("SessionRunner — step 6: restart on BAD_SEQ / BAD_TOKEN / SESSION_EXPIRED", () => {
  it("discards the session and starts a new one on a 409", async () => {
    const h = makeHarness();
    h.queue(200, sessionStartOk({ sessionId: "session-1" }));
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });
    await runner.start();

    h.queue(409, { error: { code: "BAD_SEQ" } });
    h.queue(200, sessionStartOk({ sessionId: "session-2" })); // the restart's new session/start call
    h.advance(5000);
    await h.fireScheduled();

    const restartCall = h.requests.find((r) => r.url.endsWith("/v1/session/start") && (r.body as { linkId: string }).linkId === "0xlink");
    expect(restartCall).toBeDefined();
    expect(h.requests.filter((r) => r.url.endsWith("/v1/session/start"))).toHaveLength(2);
    expect(h.hasScheduled()).toBe(true); // resumed heartbeats under the new session
  });

  it("stops after more than 3 restarts within a minute", async () => {
    const h = makeHarness();
    h.queue(200, sessionStartOk());
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });
    await runner.start();

    for (let i = 0; i < 4; i++) {
      h.queue(401, { error: { code: "BAD_TOKEN" } });
      h.queue(200, sessionStartOk());
      h.advance(5000);
      await h.fireScheduled();
    }

    expect(runner.isStopped()).toBe(true);
    expect(h.hasScheduled()).toBe(false);
  });
});

describe("SessionRunner — LINK_INACTIVE (200, ok:false) stops gracefully", () => {
  it("stops without error when the server reports ok:false", async () => {
    const h = makeHarness();
    h.queue(200, sessionStartOk());
    h.queue(200, { ok: false, reason: "LINK_INACTIVE" });
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });
    await runner.start();

    h.advance(5000);
    await h.fireScheduled();
    expect(runner.isStopped()).toBe(true);
  });
});

describe("SessionRunner — step 7: stop() never sends a final heartbeat", () => {
  it("clears the pending timer and sends nothing more after stop()", async () => {
    const h = makeHarness();
    h.queue(200, sessionStartOk());
    const collector = new StatsCollector(null, h.now());
    const runner = new SessionRunner({ linkId: "0xlink", baseUrl: "https://host", collector, fetchImpl: h.fetchImpl, now: h.now, setTimer: h.setTimer, clearTimer: h.clearTimer });
    await runner.start();

    runner.stop();
    expect(h.hasScheduled()).toBe(false);
    const countBefore = h.requests.length;
    await h.fireScheduled(); // no-op since nothing is scheduled
    expect(h.requests).toHaveLength(countBefore);
  });
});
