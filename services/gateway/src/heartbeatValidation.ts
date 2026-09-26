import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { heartbeatRequestSchema, rawStatsSchema, verifyHeartbeatMac, type ErrorCode, type RawStats } from "@kawaipay/shared";
import { getLinkMirror, isLinkPayable, type LinkMirror } from "./mirror.js";
import { getSession, type SessionRecord } from "./sessionStore.js";
import { checkPerMinuteLimit } from "./rateLimit.js";
import { RATE_LIMITS } from "./rateLimit.js";

export type HeartbeatValidationResult =
  | { kind: "error"; status: number; code: ErrorCode }
  | { kind: "link_inactive" }
  | {
      kind: "valid";
      sessionId: string;
      session: SessionRecord;
      link: LinkMirror;
      seq: number;
      token: string;
      stats: RawStats;
      serverGapMs: number;
    };

export interface HeartbeatValidationDeps {
  redis: Redis;
  pg: Pool;
  minLinkBudget: number;
}

/**
 * Runs the heartbeat validation order exactly as specified (spec section 5). A heartbeat
 * failing any step here is not scored and creates no tick. Step 8's failure is not an
 * API error — the caller is expected to respond 200 with { ok: false, reason: 'LINK_INACTIVE' }.
 */
export async function validateHeartbeat(
  deps: HeartbeatValidationDeps,
  rawBody: unknown,
  nowMs: number,
): Promise<HeartbeatValidationResult> {
  // 1. Request body matches the schema.
  const parsedBody = heartbeatRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return { kind: "error", status: 400, code: "INVALID_REQUEST" };
  }
  const { sessionId, seq, token, stats, mac } = parsedBody.data;

  // 2. Source (session) is within the rate limit.
  const withinRate = await checkPerMinuteLimit(deps.redis, "hb", sessionId, RATE_LIMITS.heartbeatsPerSessionPerMinute, nowMs);
  if (!withinRate) {
    return { kind: "error", status: 429, code: "RATE_LIMITED" };
  }

  // 3. Session exists in Redis.
  const session = await getSession(deps.redis, sessionId);
  if (!session) {
    return { kind: "error", status: 410, code: "SESSION_EXPIRED" };
  }

  // 4. MAC is valid for the session secret.
  if (!verifyHeartbeatMac(session.secret, sessionId, seq, token, stats, mac)) {
    return { kind: "error", status: 401, code: "BAD_MAC" };
  }

  // 5. seq equals the expected next value.
  if (seq !== session.expectedSeq) {
    return { kind: "error", status: 409, code: "BAD_SEQ" };
  }

  // 6. token matches the one issued with the last response.
  if (token !== session.currentToken) {
    return { kind: "error", status: 401, code: "BAD_TOKEN" };
  }

  // 7. Payload values are within plausible ranges.
  const plausible = rawStatsSchema.safeParse(stats);
  if (!plausible.success) {
    return { kind: "error", status: 422, code: "IMPLAUSIBLE_PAYLOAD" };
  }

  // 8. Link is still valid in the mirror.
  const link = await getLinkMirror(deps.pg, session.linkId);
  if (!link || !isLinkPayable(link, deps.minLinkBudget)) {
    return { kind: "link_inactive" };
  }

  const referenceMs = seq === 1 ? session.startedMs : session.lastSeenMs;
  const serverGapMs = nowMs - referenceMs;

  return { kind: "valid", sessionId, session, link, seq, token, stats: plausible.data, serverGapMs };
}
