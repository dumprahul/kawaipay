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
  };
}

export type GatewayConfig = ReturnType<typeof loadConfig>;
