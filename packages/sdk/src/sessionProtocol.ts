import { signHeartbeat } from "./mac.js";
import type { StatsCollector } from "./stats.js";

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface SessionRunnerOptions {
  linkId: string;
  baseUrl: string;
  collector: StatsCollector;
  fetchImpl: typeof fetch;
  now: () => number;
  setTimer: (fn: () => void | Promise<void>, ms: number) => number;
  clearTimer: (id: number) => void;
}

const MAX_RESTARTS_PER_MINUTE = 3;
const RESTART_WINDOW_MS = 60_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;

/**
 * Drives the session/heartbeat protocol exactly as specified (spec section 6, "Session
 * protocol"). This is the only place session state (sessionId/secret/token/seq) lives.
 */
export class SessionRunner {
  private sessionId: string | null = null;
  private secret: Uint8Array | null = null;
  private token: string | null = null;
  private seq = 0;
  private heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS;
  private timerId: number | null = null;
  private restartsInWindow = 0;
  private restartWindowStart = 0;
  private stopped = false;

  constructor(private readonly opts: SessionRunnerOptions) {}

  /** Step 1: opens a session. If tracking is false, does nothing else — the page still loads. */
  async start(): Promise<void> {
    const ok = await this.beginSession();
    if (ok) this.scheduleNext();
  }

  private async beginSession(): Promise<boolean> {
    let res: Response;
    try {
      res = await this.opts.fetchImpl(`${this.opts.baseUrl}/v1/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId: this.opts.linkId,
          client: {
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            viewport: [window.innerWidth, window.innerHeight],
          },
        }),
      });
    } catch {
      return false;
    }
    if (!res.ok) return false;

    const body = (await res.json()) as {
      tracking: boolean;
      sessionId?: string;
      secret?: string;
      token?: string;
      heartbeatIntervalMs?: number;
    };
    if (!body.tracking || !body.sessionId || !body.secret || !body.token) return false;

    this.sessionId = body.sessionId;
    this.secret = base64ToBytes(body.secret);
    this.token = body.token;
    this.heartbeatIntervalMs = body.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.seq = 0;
    return true;
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    this.timerId = this.opts.setTimer(() => this.tick(), this.heartbeatIntervalMs);
  }

  /** Steps 3-6: build stats, sign, send, and react to the response. */
  private async tick(): Promise<void> {
    if (this.stopped || !this.sessionId || !this.secret || !this.token) return;

    const now = this.opts.now();
    const stats = this.opts.collector.peek(now); // not consumed yet — only advance() on success
    const seqToSend = this.seq + 1;
    const mac = await signHeartbeat(this.secret, this.sessionId, seqToSend, this.token, stats);

    let res: Response;
    try {
      res = await this.opts.fetchImpl(`${this.opts.baseUrl}/v1/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.sessionId, seq: seqToSend, token: this.token, stats, mac }),
      });
    } catch {
      // Step 5: network error — skip this tick, keep the same token/seq, try again next
      // interval (that next attempt is the "resend," so this never resends more than once).
      this.scheduleNext();
      return;
    }

    if (res.status >= 500) {
      this.scheduleNext(); // step 5: 5xx — same handling as a network error
      return;
    }
    if (res.status === 409 || res.status === 401 || res.status === 410) {
      await this.restart(); // step 6: BAD_SEQ / BAD_TOKEN / SESSION_EXPIRED
      return;
    }
    if (!res.ok) {
      // Any other error status: not one of the specified recovery paths — skip and continue.
      this.scheduleNext();
      return;
    }

    const body = (await res.json()) as { ok: boolean; nextSeq?: number; nextToken?: string };
    if (!body.ok || !body.nextToken) {
      // A 200 with ok:false (LINK_INACTIVE) has no token to continue with — stop gracefully,
      // the same way tracking:false at session start means "do nothing else."
      this.stop();
      return;
    }

    // Step 4: success — advance state and reset the window only now.
    this.seq = seqToSend;
    this.token = body.nextToken;
    this.opts.collector.advance(now);
    this.scheduleNext();
  }

  /** Step 6: discard the session and start a new one, at most 3 restarts per minute, then stop. */
  private async restart(): Promise<void> {
    const now = this.opts.now();
    if (now - this.restartWindowStart > RESTART_WINDOW_MS) {
      this.restartWindowStart = now;
      this.restartsInWindow = 0;
    }
    this.restartsInWindow++;
    if (this.restartsInWindow > MAX_RESTARTS_PER_MINUTE) {
      this.stop();
      return;
    }

    this.sessionId = null;
    this.secret = null;
    this.token = null;
    const ok = await this.beginSession();
    if (!ok) {
      this.stop();
      return;
    }
    this.scheduleNext();
  }

  /** Step 7: stop the timer. Never sends a final heartbeat. */
  stop(): void {
    this.stopped = true;
    if (this.timerId !== null) {
      this.opts.clearTimer(this.timerId);
      this.timerId = null;
    }
  }

  isStopped(): boolean {
    return this.stopped;
  }
}
