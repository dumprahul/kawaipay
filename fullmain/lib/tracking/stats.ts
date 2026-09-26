// Vendored from packages/sdk/src/stats.ts (kawaipay backend monorepo) — unchanged.
import type { HeartbeatStats } from "./mac";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Tracks cumulative time a boolean condition (visible / focused / intersecting) is true. */
class DurationAccumulator {
  private accumulatedMs = 0;
  private lastChangeAt: number;
  private active: boolean;

  constructor(initiallyActive: boolean, now: number) {
    this.active = initiallyActive;
    this.lastChangeAt = now;
  }

  setActive(active: boolean, now: number): void {
    if (active === this.active) return;
    if (this.active) this.accumulatedMs += now - this.lastChangeAt;
    this.active = active;
    this.lastChangeAt = now;
  }

  /** Total accumulated duration as of `now`, without resetting anything. */
  peek(now: number): number {
    return this.accumulatedMs + (this.active ? now - this.lastChangeAt : 0);
  }

  /** Starts a fresh window as of `now`, discarding everything accumulated so far. */
  reset(now: number): void {
    this.accumulatedMs = 0;
    this.lastChangeAt = now;
  }
}

const GRID_CELL_PX = 32;

/**
 * Measures one page's engagement in 5-second windows (spec section 6). A sensor only:
 * it never scores, never decides, and never sends anything but the coarse counts and
 * durations listed in the stats object — no raw coordinates, no keys, no page content.
 */
export class StatsCollector {
  private windowStartMs: number;
  private readonly visible: DurationAccumulator;
  private readonly focused: DurationAccumulator;
  private readonly inViewport: DurationAccumulator;
  private maxRatioInWindow = 0;
  private scrollEvents = 0;
  private scrollDepthPctSession = 0;
  private lastScrollY: number | null = null;
  private lastScrollAt: number | null = null;
  private scrollSpeedMaxInWindow = 0;
  private pointerMoves = 0;
  private pointerCellsInWindow = new Set<string>();
  private touchEvents = 0;
  private keyEvents = 0;
  private tabSwitches = 0;
  private observer: IntersectionObserver | null = null;
  private readonly listeners: Array<() => void> = [];

  constructor(
    private readonly contentEl: Element | null,
    now: number = performance.now(),
  ) {
    const visibleNow = document.visibilityState === "visible";
    this.windowStartMs = now;
    this.visible = new DurationAccumulator(visibleNow, now);
    this.focused = new DurationAccumulator(document.hasFocus(), now);
    this.inViewport = new DurationAccumulator(false, now);
  }

  start(): void {
    const on = <K extends keyof DocumentEventMap>(
      target: Document | Window,
      type: K | string,
      handler: (ev: Event) => void,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, handler as EventListener, options);
      this.listeners.push(() => target.removeEventListener(type, handler as EventListener, options));
    };

    on(document, "visibilitychange", () => {
      const now = performance.now();
      this.visible.setActive(document.visibilityState === "visible", now);
      this.tabSwitches++;
    });
    on(window, "focus", () => this.focused.setActive(true, performance.now()));
    on(window, "blur", () => this.focused.setActive(false, performance.now()));

    on(document, "scroll", () => this.onScroll(), { passive: true, capture: true });
    on(document, "pointermove", (e) => this.onPointerMove(e as PointerEvent), { passive: true });
    on(document, "mousemove", (e) => this.onPointerMove(e as MouseEvent), { passive: true });
    for (const type of ["touchstart", "touchmove", "touchend"]) {
      on(document, type, () => {
        this.touchEvents++;
      }, { passive: true });
    }
    on(document, "keydown", () => {
      this.keyEvents++;
    });

    if (this.contentEl && "IntersectionObserver" in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          const now = performance.now();
          this.inViewport.setActive(entry.isIntersecting, now);
          this.maxRatioInWindow = Math.max(this.maxRatioInWindow, entry.intersectionRatio);
        },
        { threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1] },
      );
      this.observer.observe(this.contentEl);
    }

    this.updateScrollDepth();
  }

  stop(): void {
    for (const remove of this.listeners.splice(0)) remove();
    this.observer?.disconnect();
    this.observer = null;
  }

  private onScroll(): void {
    this.scrollEvents++;
    const now = performance.now();
    const y = window.scrollY;
    if (this.lastScrollY !== null && this.lastScrollAt !== null) {
      const dt = now - this.lastScrollAt;
      if (dt > 0) {
        const speed = (Math.abs(y - this.lastScrollY) / dt) * 1000;
        this.scrollSpeedMaxInWindow = Math.max(this.scrollSpeedMaxInWindow, speed);
      }
    }
    this.lastScrollY = y;
    this.lastScrollAt = now;
    this.updateScrollDepth();
  }

  private updateScrollDepth(): void {
    const doc = document.documentElement;
    const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
    const pct = clamp((window.scrollY / scrollable) * 100, 0, 100);
    this.scrollDepthPctSession = Math.max(this.scrollDepthPctSession, pct);
  }

  private onPointerMove(e: { clientX: number; clientY: number }): void {
    this.pointerMoves++;
    const cellX = Math.floor(e.clientX / GRID_CELL_PX);
    const cellY = Math.floor(e.clientY / GRID_CELL_PX);
    this.pointerCellsInWindow.add(`${cellX},${cellY}`);
  }

  /**
   * Builds the stats object for the window so far, WITHOUT resetting anything (spec
   * section 6, step 5: a failed heartbeat must not lose its window — the next attempt
   * has to include it). Call `advance()` separately once a heartbeat actually succeeds.
   */
  peek(now: number = performance.now()): HeartbeatStats {
    const windowMs = clamp(Math.round(now - this.windowStartMs), 3000, 8000);
    return {
      windowMs,
      visibleMs: clamp(Math.round(this.visible.peek(now)), 0, windowMs),
      focusedMs: clamp(Math.round(this.focused.peek(now)), 0, windowMs),
      inViewportMs: clamp(Math.round(this.inViewport.peek(now)), 0, windowMs),
      contentViewportRatio: clamp(this.maxRatioInWindow, 0, 1),
      scrollEvents: clamp(this.scrollEvents, 0, 5000),
      scrollDepthPct: Math.round(clamp(this.scrollDepthPctSession, 0, 100)),
      scrollSpeedMax: clamp(Math.round(this.scrollSpeedMaxInWindow / 100) * 100, 0, 100_000),
      pointerMoves: clamp(this.pointerMoves, 0, 5000),
      pointerCells: clamp(this.pointerCellsInWindow.size, 0, 400),
      touchEvents: clamp(this.touchEvents, 0, 5000),
      keyEvents: clamp(this.keyEvents, 0, 5000),
      tabSwitches: clamp(this.tabSwitches, 0, 50),
    };
  }

  /** Starts a fresh window as of `now` — call only after a heartbeat is confirmed sent. */
  advance(now: number = performance.now()): void {
    this.visible.reset(now);
    this.focused.reset(now);
    this.inViewport.reset(now);
    this.windowStartMs = now;
    this.maxRatioInWindow = 0;
    this.scrollEvents = 0;
    this.scrollSpeedMaxInWindow = 0;
    this.pointerMoves = 0;
    this.pointerCellsInWindow = new Set();
    this.touchEvents = 0;
    this.keyEvents = 0;
    this.tabSwitches = 0;
  }

  /** Convenience for tests and one-shot use: peek then immediately advance. */
  snapshot(now: number = performance.now()): HeartbeatStats {
    const stats = this.peek(now);
    this.advance(now);
    return stats;
  }
}
