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
});

app
  .listen({ port: config.port, host: "0.0.0.0" })
  .then(() => console.log(`kawaipay-gateway listening on :${config.port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
