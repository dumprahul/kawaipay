import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import {
  campaignIdParamSchema,
  campaignListQuerySchema,
  campaignMetadataRequestSchema,
  linkHistoryQuerySchema,
  linkIdParamSchema,
  MetricsRegistry,
  sessionStartRequestSchema,
} from "@kawaipay/shared";
import { startSession, type SessionStartDeps } from "./sessionStart.js";
import { validateHeartbeat } from "./heartbeatValidation.js";
import { scoreAndPersistHeartbeat } from "./scoring.js";
import { getLinkHistory } from "./history.js";
import { getCampaign, setCampaignMetadata } from "./campaignMetadata.js";
import { listCampaigns } from "./campaignList.js";
import { listCampaignLinks } from "./campaignLinks.js";
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

const log = (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ msg, service: "gateway", ...meta }));

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  // The frontend calls this from a different origin (its own Next.js host, not this
  // service's) — every browser fetch here is cross-origin, so without this every one of
  // them would be silently blocked by the browser regardless of what the server itself
  // returns. Wide open (any origin) is deliberate: this API has no cookies/session state
  // tied to an origin — auth is per-request (session secret in the body, Sui signatures),
  // so there's nothing an allow-list would protect that isn't already protected server-side.
  void app.register(cors, { origin: true });
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
    log("session start", {
      linkId: parsed.data.linkId,
      tracking: result.tracking,
      reason: result.tracking ? undefined : result.reason,
    });
    return reply.status(200).send(result);
  });

  app.post("/v1/heartbeat", async (req, reply) => {
    const nowMs = Date.now();
    const validated = await validateHeartbeat({ redis: deps.redis, pg: deps.pg, minLinkBudget: deps.minLinkBudget }, req.body, nowMs);

    if (validated.kind === "error") {
      metrics.heartbeats.inc({ outcome: "error" });
      log("heartbeat rejected", { code: validated.code });
      return reply.status(validated.status).send({ error: { code: validated.code, message: validated.code } });
    }
    if (validated.kind === "link_inactive") {
      metrics.heartbeats.inc({ outcome: "link_inactive" });
      log("heartbeat rejected", { code: "LINK_INACTIVE" });
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

  app.get("/v1/campaigns", async (req, reply) => {
    const query = campaignListQuerySchema.safeParse(req.query);
    if (!query.success) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "malformed query" } });
    }
    const page = await listCampaigns(deps.pg, query.data);
    return reply.status(200).send(page);
  });

  app.get("/v1/campaigns/:campaignId/links", async (req, reply) => {
    const params = campaignIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "malformed campaignId" } });
    }
    const links = await listCampaignLinks(deps.pg, params.data.campaignId);
    return reply.status(200).send({ links });
  });

  app.get("/v1/campaigns/:campaignId", async (req, reply) => {
    const params = campaignIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "malformed campaignId" } });
    }
    const campaign = await getCampaign(deps.pg, params.data.campaignId);
    if (!campaign) {
      return reply.status(404).send({ error: { code: "CAMPAIGN_NOT_FOUND", message: "no such campaign" } });
    }
    return reply.status(200).send(campaign);
  });

  app.put("/v1/campaigns/:campaignId/metadata", async (req, reply) => {
    const params = campaignIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "malformed campaignId" } });
    }
    const body = campaignMetadataRequestSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "malformed campaign metadata body" } });
    }

    const outcome = await setCampaignMetadata(deps.pg, params.data.campaignId, body.data);
    switch (outcome.kind) {
      case "not_found":
        return reply.status(404).send({ error: { code: "CAMPAIGN_NOT_FOUND", message: "no such campaign" } });
      case "bad_signature":
        return reply.status(401).send({ error: { code: "BAD_SIGNATURE", message: "signature does not match this campaign's seller" } });
      case "ok":
        return reply.status(200).send(outcome.campaign);
    }
  });

  return app;
}
