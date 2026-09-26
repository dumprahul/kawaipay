import type { Pool } from "pg";
import type { Redis } from "ioredis";
import {
  bucketStats,
  DEFAULT_CAP_LIMITS,
  TICK_SECONDS,
  type BucketedStats,
  type HistoryTick,
  type RawStats,
} from "@kawaipay/shared";
import { scoreTick, type TickScoringInput } from "@kawaipay/oracle-core";
import { getLinkFirstTickMs, getRecentTicks, type LinkMirror } from "./mirror.js";
import { advanceSession, generateToken, type SessionRecord } from "./sessionStore.js";
import { hourBucket, linkHourlyCapKey, sourceHourlyCapKey } from "./redisKeys.js";

const CAP_KEY_TTL_S = 3700; // a little over an hour, so a slow-starting hour still has its counter

// Server-side only — never derived from or sent in the HTTP response (see the "MUST NOT
// forward anything from the TickResult to the client" note below). Railway log visibility
// for what the oracle actually verified on every tick.
const log = (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ msg, service: "gateway", ...meta }));

export interface ScoreAndPersistParams {
  sessionId: string;
  session: SessionRecord;
  link: LinkMirror;
  seq: number;
  stats: RawStats;
  serverGapMs: number;
  nowMs: number;
}

export interface HeartbeatResponse {
  ok: true;
  nextSeq: number;
  nextToken: string;
}

/**
 * Scores one validated heartbeat with oracle-core and persists the result (spec section 7).
 * The caller MUST NOT forward anything from the TickResult to the client — only the
 * returned { ok, nextSeq, nextToken } is safe to expose (spec section 5).
 */
export async function scoreAndPersistHeartbeat(pg: Pool, redis: Redis, params: ScoreAndPersistParams): Promise<HeartbeatResponse> {
  const { sessionId, session, link, seq, stats, serverGapMs, nowMs } = params;

  const bucketed = bucketStats(stats);
  const historyRows = await getRecentTicks(pg, sessionId, 12);
  const history: HistoryTick[] = historyRows.map((r) => ({
    stats: r.features as BucketedStats,
    gapMs: r.gapMs,
    score: r.score,
  }));
  const linkFirstTickMs = (await getLinkFirstTickMs(pg, link.linkId)) ?? nowMs;

  const input: TickScoringInput = {
    stats: bucketed,
    serverGapMs,
    history,
    ipClass: session.ipClass,
    sessionSecondsPaid: session.sessionSecondsPaid,
    linkRisk: { weightMultiplier: link.weightMultiplier, hold: link.hold },
    ratePerSecond: link.ratePerSecond,
    linkFirstTickMs,
    nowMs,
  };

  const hb = hourBucket(nowMs);
  const [linkHourlyEarnedRaw, sourceHourlyEarnedRaw] = await redis.mget(
    linkHourlyCapKey(link.linkId, hb),
    sourceHourlyCapKey(link.linkId, session.ipHash, hb),
  );
  const capUsage = {
    linkHourlyEarned: linkHourlyEarnedRaw ? Number.parseInt(linkHourlyEarnedRaw, 10) : 0,
    sourceHourlyEarned: sourceHourlyEarnedRaw ? Number.parseInt(sourceHourlyEarnedRaw, 10) : 0,
  };

  const result = scoreTick(input, capUsage, DEFAULT_CAP_LIMITS);

  log("heartbeat scored", {
    linkId: link.linkId,
    sessionId,
    seq,
    verdict: result.verdict,
    score: result.score,
    amountUsdcBaseUnits: result.amount,
    reasons: result.reasons,
  });

  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO ticks (session_id, link_id, seq, received_at, server_gap_ms, features, score, verdict, weight, amount, reasons, scorer_version)
       VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        sessionId,
        link.linkId,
        seq,
        nowMs,
        serverGapMs,
        JSON.stringify(bucketed),
        result.score,
        result.verdict,
        result.weightBp / 10000,
        result.amount,
        result.reasons,
        result.scorerVersion,
      ],
    );
    await client.query(
      `INSERT INTO accruals (link_id, earned_total, settled_total) VALUES ($1, $2, 0)
       ON CONFLICT (link_id) DO UPDATE SET earned_total = accruals.earned_total + EXCLUDED.earned_total`,
      [link.linkId, result.amount],
    );
    await client.query(`UPDATE sessions SET last_seen_at = to_timestamp($2 / 1000.0), tick_count = tick_count + 1 WHERE session_id = $1`, [
      sessionId,
      nowMs,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (result.amount > 0) {
    const multi = redis.multi();
    multi.incrby(linkHourlyCapKey(link.linkId, hb), result.amount);
    multi.expire(linkHourlyCapKey(link.linkId, hb), CAP_KEY_TTL_S);
    multi.incrby(sourceHourlyCapKey(link.linkId, session.ipHash, hb), result.amount);
    multi.expire(sourceHourlyCapKey(link.linkId, session.ipHash, hb), CAP_KEY_TTL_S);
    await multi.exec();
  }

  const nextSeq = seq + 1;
  const nextToken = generateToken();
  await advanceSession(redis, sessionId, {
    expectedSeq: nextSeq,
    token: nextToken,
    lastSeenMs: nowMs,
    sessionSecondsPaid: session.sessionSecondsPaid + TICK_SECONDS,
  });

  return { ok: true, nextSeq, nextToken };
}
