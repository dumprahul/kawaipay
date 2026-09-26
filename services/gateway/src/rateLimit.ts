import type { Redis } from "ioredis";
import { concurrentSessionsKey, minuteBucket, rateLimitKey } from "./redisKeys.js";

/** Defaults from spec section 5, "Rate limits (default)". */
export const RATE_LIMITS = {
  sessionStartsPerSourcePerMinute: 10,
  heartbeatsPerSessionPerMinute: 30,
  concurrentSessionsPerSourcePerLink: 3,
  dashboardRequestsPerMinute: 60,
} as const;

const MINUTE_KEY_TTL_S = 120;

/** Atomically increments a per-minute counter and reports whether it's still within `limit`. */
export async function checkPerMinuteLimit(
  redis: Redis,
  prefix: string,
  sourceId: string,
  limit: number,
  nowMs: number,
): Promise<boolean> {
  const key = rateLimitKey(prefix, sourceId, minuteBucket(nowMs));
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, MINUTE_KEY_TTL_S);
  }
  return count <= limit;
}

/**
 * Registers this session against its source+link concurrency set and reports whether
 * the source is still within the concurrent-session cap for that link (section 5, 6).
 */
export async function checkConcurrentSessions(
  redis: Redis,
  linkId: string,
  ipHash: string,
  sessionId: string,
  limit: number,
): Promise<boolean> {
  const key = concurrentSessionsKey(linkId, ipHash);
  await redis.sadd(key, sessionId);
  await redis.expire(key, 20);
  const count = await redis.scard(key);
  return count <= limit;
}
