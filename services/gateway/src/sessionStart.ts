import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { classifyIp, getLinkMirror } from "./mirror.js";
import { createSession } from "./sessionStore.js";
import { checkConcurrentSessions, checkPerMinuteLimit, RATE_LIMITS } from "./rateLimit.js";
import { hashIp } from "./ipHash.js";

export type SessionStartResult =
  | { tracking: true; sessionId: string; secret: string; token: string; heartbeatIntervalMs: number; sessionTtlMs: number }
  | {
      tracking: false;
      reason: "RATE_LIMITED" | "LINK_NOT_FOUND" | "LINK_FROZEN" | "CAMPAIGN_INACTIVE" | "BUDGET_TOO_LOW" | "TOO_MANY_CONCURRENT_SESSIONS";
    };

export interface SessionStartDeps {
  redis: Redis;
  pg: Pool;
  minLinkBudget: number;
  tickMs: number;
  sessionTtlMs: number;
  ipHashSalt: string;
}

/**
 * Validates the link and, if payable, opens a session (spec section 5's POST /v1/session/start).
 * An invalid/frozen/out-of-budget/inactive link is NOT an HTTP error — the page still loads,
 * it just gets { tracking: false, reason }. `ip` is the caller's raw address: it is used
 * only in-memory, for rate limiting and classification, and is never persisted — only its
 * salted hash is (spec section 4 invariant 5, section 13 security requirement 6).
 */
export async function startSession(deps: SessionStartDeps, linkId: string, ip: string, nowMs: number): Promise<SessionStartResult> {
  const ipHash = hashIp(ip, deps.ipHashSalt);

  const withinRate = await checkPerMinuteLimit(deps.redis, "ss", ipHash, RATE_LIMITS.sessionStartsPerSourcePerMinute, nowMs);
  if (!withinRate) {
    return { tracking: false, reason: "RATE_LIMITED" };
  }

  const link = await getLinkMirror(deps.pg, linkId);
  if (!link) {
    return { tracking: false, reason: "LINK_NOT_FOUND" };
  }
  if (link.frozen) {
    return { tracking: false, reason: "LINK_FROZEN" };
  }
  if (!link.campaignActive) {
    return { tracking: false, reason: "CAMPAIGN_INACTIVE" };
  }
  if (link.budgetRemaining < deps.minLinkBudget) {
    return { tracking: false, reason: "BUDGET_TOO_LOW" };
  }

  const ipClass = classifyIp(ip);
  const { sessionId, secret, token } = await createSession(deps.redis, linkId, ipHash, ipClass, nowMs);

  const withinConcurrency = await checkConcurrentSessions(
    deps.redis,
    linkId,
    ipHash,
    sessionId,
    RATE_LIMITS.concurrentSessionsPerSourcePerLink,
  );
  if (!withinConcurrency) {
    return { tracking: false, reason: "TOO_MANY_CONCURRENT_SESSIONS" };
  }

  await deps.pg.query(
    `INSERT INTO sessions (session_id, link_id, started_at, last_seen_at, ip_hash, ip_class)
     VALUES ($1, $2, to_timestamp($3 / 1000.0), to_timestamp($3 / 1000.0), $4, $5)`,
    [sessionId, linkId, nowMs, Buffer.from(ipHash, "hex"), ipClass],
  );

  return {
    tracking: true,
    sessionId,
    secret: Buffer.from(secret).toString("base64"),
    token,
    heartbeatIntervalMs: deps.tickMs,
    sessionTtlMs: deps.sessionTtlMs,
  };
}
