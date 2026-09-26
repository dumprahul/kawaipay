import { ATT_TTL_MS, BATCH_INTERVAL_MS, MAX_ITEMS_PER_BATCH, MIN_SETTLE_UNITS, MIRROR_MAX_LAG_MS } from "@kawaipay/shared";

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

export function loadConfig() {
  return {
    databaseUrl: required("DATABASE_URL"),
    packageId: required("PACKAGE_ID"),
    registryId: required("REGISTRY_ID"),
    usdcType: required("USDC_TYPE"),
    graphqlUrl: required("SUI_GRAPHQL_URL"),
    network: process.env.SUI_NETWORK ?? "testnet",
    oracleSignerKeyHex: required("ORACLE_SIGNER_KEY"),
    relayerKeyHex: required("RELAYER_KEY"),
    relayerMinSui: optionalInt("RELAYER_MIN_SUI", 100_000_000), // 0.1 SUI default
    batchIntervalMs: optionalInt("BATCH_INTERVAL_MS", BATCH_INTERVAL_MS),
    attTtlMs: optionalInt("ATT_TTL_MS", ATT_TTL_MS),
    maxItemsPerBatch: optionalInt("MAX_ITEMS_PER_BATCH", MAX_ITEMS_PER_BATCH),
    minSettleUnits: optionalInt("MIN_SETTLE_UNITS", MIN_SETTLE_UNITS),
    mirrorMaxLagMs: optionalInt("MIRROR_MAX_LAG_MS", MIRROR_MAX_LAG_MS),
    metricsPort: optionalInt("METRICS_PORT", 9101),
    // World ID payout gating — must match the gateway's own WORLD_ID_FREE_PAYOUTS.
    worldIdFreePayouts: optionalInt("WORLD_ID_FREE_PAYOUTS", 2),
    worldIdValidityDays: optionalInt("WORLD_ID_VALIDITY_DAYS", 7),
  };
}

export type BatcherConfig = ReturnType<typeof loadConfig>;
