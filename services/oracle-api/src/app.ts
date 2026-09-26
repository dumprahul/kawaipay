import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { Pool } from "pg";
import { MetricsRegistry, oracleVerdictRequestSchema } from "@kawaipay/shared";
import type { FacilitatorClient } from "./facilitatorClient.js";
import type { PaymentRequirementsConfig } from "./paymentRequirements.js";
import { handleOracleVerdictRequest } from "./handler.js";
import { registerOracleApiMetrics } from "./metrics.js";

export interface AppDeps {
  pg: Pool;
  facilitator: FacilitatorClient;
  config: PaymentRequirementsConfig;
  metricsRegistry?: MetricsRegistry;
}

const log = (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ msg, service: "oracle-api", ...meta }));

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  void app.register(cors, { origin: true }); // called from a different origin (the frontend) — see gateway/src/app.ts for the full reasoning
  const registry = deps.metricsRegistry ?? new MetricsRegistry();
  const metrics = registerOracleApiMetrics(registry);

  app.get("/health", async () => ({ ok: true }));

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", "text/plain; version=0.0.4");
    return reply.status(200).send(registry.render());
  });

  app.post("/v1/oracle/verdict", async (req, reply) => {
    const parsed = oracleVerdictRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "malformed oracle/verdict body" } });
    }

    const paymentHeader = req.headers["x-payment"];
    const outcome = await handleOracleVerdictRequest(
      { pg: deps.pg, facilitator: deps.facilitator, config: deps.config },
      parsed.data,
      typeof paymentHeader === "string" ? paymentHeader : undefined,
      Date.now(),
    );
    metrics.verdictRequests.inc({ outcome: outcome.kind });

    switch (outcome.kind) {
      case "payment_required":
        log("402 — no payment attached", { accepts: outcome.accepts[0] });
        return reply.status(402).send({ x402Version: 2, error: "X-PAYMENT header is required", accepts: outcome.accepts });
      case "malformed_payment":
        log("400 — malformed X-PAYMENT header", { message: outcome.message });
        return reply.status(400).send({ error: { code: "MALFORMED_PAYMENT", message: outcome.message } });
      case "invalid_payment":
        log("402 — payment rejected by facilitator verify", { reason: outcome.reason });
        return reply.status(402).send({ x402Version: 2, error: outcome.reason });
      case "settle_failed":
        log("402 — facilitator settle failed", { reason: outcome.reason });
        return reply.status(402).send({ x402Version: 2, error: outcome.reason });
      case "ok":
        if (!outcome.cached) metrics.paymentsSettled.inc();
        log("200 — payment settled, verdict served", { txDigest: outcome.txDigest, cached: outcome.cached });
        reply.header("X-PAYMENT-RESPONSE", Buffer.from(JSON.stringify({ success: true, transaction: outcome.txDigest })).toString("base64"));
        return reply.status(200).send(outcome.response);
    }
  });

  return app;
}
