import { randomBytes, randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import type { IpClass } from "@kawaipay/shared";
import { sessionKey } from "./redisKeys.js";

/** Refreshed on each valid heartbeat (spec section 6's Redis key table). */
export const SESSION_REDIS_TTL_MS = 20_000;

export interface SessionRecord {
  linkId: string;
  /** Raw bytes, decoded from the stored base64 form. */
  secret: Uint8Array;
  expectedSeq: number;
  currentToken: string;
  lastSeenMs: number;
  startedMs: number;
  ipHash: string;
  ipClass: IpClass;
  sessionSecondsPaid: number;
}

export function generateToken(): string {
  return randomBytes(18).toString("base64url");
}

export interface NewSession {
  sessionId: string;
  secret: Uint8Array;
  token: string;
}

/** Creates a fresh session (spec section 6): expected_seq starts at 1, matching the SDK's first heartbeat. */
export async function createSession(
  redis: Redis,
  linkId: string,
  ipHash: string,
  ipClass: IpClass,
  nowMs: number,
): Promise<NewSession> {
  const sessionId = randomUUID();
  const secret = randomBytes(32);
  const token = generateToken();

  await redis.hset(sessionKey(sessionId), {
    link_id: linkId,
    secret: secret.toString("base64"),
    expected_seq: "1",
    current_token_id: token,
    last_seen_ms: String(nowMs),
    started_ms: String(nowMs),
    ip_hash: ipHash,
    ip_class: ipClass,
    session_seconds_paid: "0",
  });
  await redis.pexpire(sessionKey(sessionId), SESSION_REDIS_TTL_MS);

  return { sessionId, secret: new Uint8Array(secret), token };
}

export async function getSession(redis: Redis, sessionId: string): Promise<SessionRecord | null> {
  const h = await redis.hgetall(sessionKey(sessionId));
  if (!h || Object.keys(h).length === 0) return null;
  return {
    linkId: h.link_id!,
    secret: new Uint8Array(Buffer.from(h.secret!, "base64")),
    expectedSeq: Number.parseInt(h.expected_seq!, 10),
    currentToken: h.current_token_id!,
    lastSeenMs: Number.parseInt(h.last_seen_ms!, 10),
    startedMs: Number.parseInt(h.started_ms!, 10),
    ipHash: h.ip_hash!,
    ipClass: h.ip_class as IpClass,
    sessionSecondsPaid: Number.parseInt(h.session_seconds_paid!, 10),
  };
}

/** Advances the token chain and sequence after a valid heartbeat, refreshing the TTL. */
export async function advanceSession(
  redis: Redis,
  sessionId: string,
  next: { expectedSeq: number; token: string; lastSeenMs: number; sessionSecondsPaid: number },
): Promise<void> {
  await redis.hset(sessionKey(sessionId), {
    expected_seq: String(next.expectedSeq),
    current_token_id: next.token,
    last_seen_ms: String(next.lastSeenMs),
    session_seconds_paid: String(next.sessionSecondsPaid),
  });
  await redis.pexpire(sessionKey(sessionId), SESSION_REDIS_TTL_MS);
}
