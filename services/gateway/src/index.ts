import Redis from "ioredis";
import { createPgPool, loadEnv } from "@kawaipay/shared";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";

loadEnv();
const config = loadConfig();
const pg = createPgPool(config.databaseUrl);
const redis = new Redis(config.redisUrl);

const app = buildApp({
  pg,
  redis,
  minLinkBudget: config.minLinkBudget,
  tickMs: config.tickMs,
  sessionTtlMs: config.sessionTtlMs,
  ipHashSalt: config.ipHashSalt,
  worldId: config.worldId,
  worldIdFreePayouts: config.worldIdFreePayouts,
});

app
  .listen({ port: config.port, host: "0.0.0.0" })
  .then(() =>
    console.log(
      JSON.stringify({ msg: "gateway listening", service: "gateway", port: config.port, worldIdConfigured: config.worldId !== null }),
    ),
  )
  .catch((err) => {
    console.error(JSON.stringify({ msg: "gateway failed to start", service: "gateway", error: err instanceof Error ? err.message : String(err) }));
    process.exit(1);
  });
