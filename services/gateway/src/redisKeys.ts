/** Redis key builders matching the table in spec section 6. */

export function sessionKey(sessionId: string): string {
  return `sess:${sessionId}`;
}

export function rateLimitKey(prefix: string, sourceId: string, minuteBucket: number): string {
  return `rl:${prefix}:${sourceId}:${minuteBucket}`;
}

export function concurrentSessionsKey(linkId: string, ipHash: string): string {
  return `conc:${linkId}:${ipHash}`;
}

export function mirrorLinkKey(linkId: string): string {
  return `mirror:link:${linkId}`;
}

/** Not in the spec's Redis table by name, but same pattern: hour-bucketed cap counters (section 7 step 5). */
export function linkHourlyCapKey(linkId: string, hourBucket: number): string {
  return `caphr:link:${linkId}:${hourBucket}`;
}

export function sourceHourlyCapKey(linkId: string, ipHash: string, hourBucket: number): string {
  return `caphr:src:${linkId}:${ipHash}:${hourBucket}`;
}

export function minuteBucket(nowMs: number): number {
  return Math.floor(nowMs / 60_000);
}

export function hourBucket(nowMs: number): number {
  return Math.floor(nowMs / 3_600_000);
}
