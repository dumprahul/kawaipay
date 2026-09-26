import { HEARTBEAT_INTERVAL_MS, MIN_LINK_BUDGET, SESSION_TTL_MS } from "@kawaipay/shared";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function optionalInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Environment variable ${name} must be an integer, got ${v}`);
  return n;
}

/**
 * World ID credentials are optional at startup on purpose — they land after the rest
 * of this deploy, and nothing else in the gateway (heartbeats, sessions, campaigns)
 * should go down for lack of them. The /v1/worldid/* routes return a clear 503 if
 * called before these are actually configured, instead of the whole service refusing
 * to boot.
 */
export interface WorldIdConfig {
  appId: string;
  rpId: string;
  signingKeyHex: string;
  environment: "staging" | "production";
  stagingToken?: string;
}

function loadWorldIdConfig(): WorldIdConfig | null {
  const appId = process.env.WORLD_APP_ID;
  const rpId = process.env.WORLD_RP_ID;
  const signingKeyHex = process.env.RP_SIGNING_KEY;
  if (!appId || !rpId || !signingKeyHex) return null;
  return {
    appId,
    rpId,
    signingKeyHex,
    environment: process.env.WORLD_ENVIRONMENT === "production" ? "production" : "staging",
    stagingToken: process.env.WORLD_STAGING_TOKEN,
  };
}

/**
 * Fails fast at startup if a required variable is missing or malformed (spec section 13).
 * Call this once, at process start — not per-request.
 */
export function loadConfig() {
  return {
    databaseUrl: required("DATABASE_URL"),
    redisUrl: required("REDIS_URL"),
    ipHashSalt: required("IP_HASH_SALT"),
    port: optionalInt("PORT", 8080),
    tickMs: optionalInt("TICK_MS", HEARTBEAT_INTERVAL_MS),
    sessionTtlMs: optionalInt("SESSION_TTL_MS", SESSION_TTL_MS),
    minLinkBudget: optionalInt("MIN_LINK_BUDGET", MIN_LINK_BUDGET),
    worldId: loadWorldIdConfig(),
    // Must match the batcher's own WORLD_ID_FREE_PAYOUTS (services/batcher/src/config.ts) —
    // this copy is only for the /v1/worldid/status response, so the frontend can show an
    // accurate "N free payouts left" without needing batcher-internal access.
    worldIdFreePayouts: optionalInt("WORLD_ID_FREE_PAYOUTS", 2),
  };
}

export type GatewayConfig = ReturnType<typeof loadConfig>;
