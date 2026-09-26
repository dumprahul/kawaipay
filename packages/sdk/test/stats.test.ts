import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatsCollector } from "../src/stats.js";

let now = 0;
function advance(ms: number) {
  now += ms;
}

beforeEach(() => {
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  // jsdom shares one `window` per test file, so DOM property overrides from a previous
  // test otherwise leak in; reset the ones StatsCollector reads before each test.
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", { value: 0, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("StatsCollector — ranges and windowMs", () => {
  it("clamps windowMs into [3000, 8000] and reports 0s for an untouched window", () => {
    const collector = new StatsCollector(null, now);
    collector.start();
    advance(1000); // below the 3000 floor
    const stats = collector.snapshot(now);
    expect(stats.windowMs).toBe(3000);
    expect(stats.scrollEvents).toBe(0);
    expect(stats.pointerMoves).toBe(0);
    collector.stop();
  });

  it("clamps windowMs at 8000 even if far more time elapsed (e.g. after a skipped tick)", () => {
    const collector = new StatsCollector(null, now);
    collector.start();
    advance(15000);
    expect(collector.snapshot(now).windowMs).toBe(8000);
    collector.stop();
  });
});

describe("StatsCollector — visibility and focus durations", () => {
  it("reports visibleMs 0 when the tab is hidden the whole window, without faking activity", () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    const collector = new StatsCollector(null, now);
    collector.start();
    advance(5000);
    const stats = collector.snapshot(now);
    expect(stats.visibleMs).toBe(0);
    collector.stop();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("accumulates focusedMs only while the window has focus", () => {
    // jsdom's document.hasFocus() defaults to false, unlike a real browser tab a
    // reader has just opened — the collector must still track transitions correctly
    // regardless of the starting state, so we drive it explicitly here.
    const collector = new StatsCollector(null, now);
    collector.start();
    window.dispatchEvent(new Event("focus"));
    advance(2000); // focused
    window.dispatchEvent(new Event("blur"));
    advance(3000); // blurred
    const stats = collector.snapshot(now);
    expect(stats.focusedMs).toBe(2000);
    collector.stop();
  });

  it("counts a tabSwitch on each visibilitychange event", () => {
    const collector = new StatsCollector(null, now);
    collector.start();
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(collector.snapshot(now).tabSwitches).toBe(2);
    collector.stop();
  });
});

describe("StatsCollector — scroll", () => {
  it("counts scroll events and computes scrollSpeedMax rounded to the nearest 100", () => {
    const collector = new StatsCollector(null, now);
    collector.start();

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    document.dispatchEvent(new Event("scroll"));
    advance(100);
    Object.defineProperty(window, "scrollY", { value: 1000, configurable: true }); // 1000px in 100ms = 10,000px/s
    document.dispatchEvent(new Event("scroll"));

    const stats = collector.snapshot(now);
    expect(stats.scrollEvents).toBe(2);
    expect(stats.scrollSpeedMax).toBe(10_000);
    collector.stop();
  });

  it("tracks scrollDepthPct as the deepest point reached so far in the session, across windows", () => {
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 1000, configurable: true }); // scrollable = 1000

    const collector = new StatsCollector(null, now);
    collector.start();

    Object.defineProperty(window, "scrollY", { value: 500, configurable: true }); // 50%
    document.dispatchEvent(new Event("scroll"));
    expect(collector.snapshot(now).scrollDepthPct).toBe(50);

    Object.defineProperty(window, "scrollY", { value: 200, configurable: true }); // scrolled back up to 20%
    document.dispatchEvent(new Event("scroll"));
    // Deepest point reached so far in the SESSION stays 50, even though we scrolled up.
    expect(collector.snapshot(now).scrollDepthPct).toBe(50);
    collector.stop();
  });
});

describe("StatsCollector — pointer and touch", () => {
  it("counts pointer moves and distinct 32x32 grid cells visited", () => {
    const collector = new StatsCollector(null, now);
    collector.start();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 10 })); // cell (0,0)
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 20 })); // same cell (0,0)
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 100, clientY: 10 })); // cell (3,0)
    const stats = collector.snapshot(now);
    expect(stats.pointerMoves).toBe(3);
    expect(stats.pointerCells).toBe(2);
    collector.stop();
  });

  it("counts touch events", () => {
    const collector = new StatsCollector(null, now);
    collector.start();
    document.dispatchEvent(new Event("touchstart"));
    document.dispatchEvent(new Event("touchmove"));
    document.dispatchEvent(new Event("touchend"));
    expect(collector.snapshot(now).touchEvents).toBe(3);
    collector.stop();
  });

  it("counts key events without ever recording which key", () => {
    const collector = new StatsCollector(null, now);
    collector.start();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    const stats = collector.snapshot(now);
    expect(stats.keyEvents).toBe(2);
    expect(JSON.stringify(stats)).not.toContain("Enter"); // never leaks key content
    collector.stop();
  });
});

describe("StatsCollector — IntersectionObserver", () => {
  it("reports inViewportMs 0 and contentViewportRatio 0 when IntersectionObserver is unavailable", () => {
    const original = window.IntersectionObserver;
    // @ts-expect-error simulating an older browser
    delete window.IntersectionObserver;

    const el = document.createElement("main");
    document.body.appendChild(el);
    const collector = new StatsCollector(el, now);
    collector.start();
    advance(5000);
    const stats = collector.snapshot(now);
    expect(stats.inViewportMs).toBe(0);
    expect(stats.contentViewportRatio).toBe(0);
    collector.stop();

    window.IntersectionObserver = original;
  });

  it("tracks inViewportMs and the max ratio seen when IntersectionObserver is available", () => {
    let callback!: IntersectionObserverCallback;
    class FakeIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe() {}
      disconnect() {}
    }
    const original = window.IntersectionObserver;
    // @ts-expect-error minimal fake, not the full spec
    window.IntersectionObserver = FakeIntersectionObserver;

    const el = document.createElement("main");
    document.body.appendChild(el);
    const collector = new StatsCollector(el, now);
    collector.start();

    callback([{ isIntersecting: true, intersectionRatio: 0.6 } as IntersectionObserverEntry], null as unknown as IntersectionObserver);
    advance(3000);
    const stats = collector.snapshot(now);
    expect(stats.inViewportMs).toBe(3000);
    expect(stats.contentViewportRatio).toBe(0.6);

    collector.stop();
    window.IntersectionObserver = original;
  });
});

describe("StatsCollector — peek vs advance vs snapshot", () => {
  it("peek does not reset the window; advance does", () => {
    const collector = new StatsCollector(null, now);
    collector.start();
    document.dispatchEvent(new Event("touchstart"));

    advance(4000);
    const peeked = collector.peek(now);
    expect(peeked.touchEvents).toBe(1);
    expect(peeked.windowMs).toBe(4000);

    // Peeking again without advancing shows the SAME accumulated data, just a bit later.
    advance(1000);
    const peekedAgain = collector.peek(now);
    expect(peekedAgain.touchEvents).toBe(1);
    expect(peekedAgain.windowMs).toBe(5000);

    collector.advance(now);
    advance(1000); // below the 3000ms floor — windowMs is clamped, not a bug
    const afterAdvance = collector.peek(now);
    expect(afterAdvance.touchEvents).toBe(0); // window reset
    expect(afterAdvance.windowMs).toBe(3000);

    collector.stop();
  });
});
