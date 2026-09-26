import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { linkHistoryQuerySchema, linkIdParamSchema, MetricsRegistry, sessionStartRequestSchema } from "@kawaipay/shared";
import { startSession, type SessionStartDeps } from "./sessionStart.js";
import { validateHeartbeat } from "./heartbeatValidation.js";
import { scoreAndPersistHeartbeat } from "./scoring.js";
import { getLinkHistory } from "./history.js";
import { registerGatewayMetrics } from "./metrics.js";

export interface AppDeps {
  pg: Pool;
  redis: Redis;
  minLinkBudget: number;
  tickMs: number;
  sessionTtlMs: number;
  ipHashSalt: string;
  metricsRegistry?: MetricsRegistry;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  const registry = deps.metricsRegistry ?? new MetricsRegistry();
  const metrics = registerGatewayMetrics(registry);

  const sessionStartDeps: SessionStartDeps = {
    redis: deps.redis,
    pg: deps.pg,
    minLinkBudget: deps.minLinkBudget,
    tickMs: deps.tickMs,
    sessionTtlMs: deps.sessionTtlMs,
    ipHashSalt: deps.ipHashSalt,
  };

  app.get("/health", async () => ({ ok: true }));

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", "text/plain; version=0.0.4");
    return reply.status(200).send(registry.render());
  });

  app.post("/v1/session/start", async (req, reply) => {
    const parsed = sessionStartRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "malformed session/start body" } });
    }
    const result = await startSession(sessionStartDeps, parsed.data.linkId, req.ip, Date.now());
    metrics.sessionsStarted.inc({ tracking: String(result.tracking) });
    return reply.status(200).send(result);
  });

  app.post("/v1/heartbeat", async (req, reply) => {
    const nowMs = Date.now();
    const validated = await validateHeartbeat({ redis: deps.redis, pg: deps.pg, minLinkBudget: deps.minLinkBudget }, req.body, nowMs);

    if (validated.kind === "error") {
      metrics.heartbeats.inc({ outcome: "error" });
      return reply.status(validated.status).send({ error: { code: validated.code, message: validated.code } });
    }
    if (validated.kind === "link_inactive") {
      metrics.heartbeats.inc({ outcome: "link_inactive" });
      return reply.status(200).send({ ok: false, reason: "LINK_INACTIVE" });
    }

    const response = await scoreAndPersistHeartbeat(deps.pg, deps.redis, {
      sessionId: validated.sessionId,
      session: validated.session,
      link: validated.link,
      seq: validated.seq,
      stats: validated.stats,
      serverGapMs: validated.serverGapMs,
      nowMs,
    });
    metrics.heartbeats.inc({ outcome: "ok" });
    // response is exactly { ok, nextSeq, nextToken } — never the score/verdict/weight/amount.
    return reply.status(200).send(response);
  });

  app.get("/v1/links/:linkId/history", async (req, reply) => {
    const params = linkIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "malformed linkId" } });
    }
    const query = linkHistoryQuerySchema.safeParse(req.query);
    if (!query.success) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "malformed query" } });
    }

    const page = await getLinkHistory(deps.pg, params.data.linkId, query.data);
    if (!page) {
      return reply.status(404).send({ error: { code: "LINK_NOT_FOUND", message: "no such link" } });
    }
    return reply.status(200).send(page);
  });

  return app;
}
