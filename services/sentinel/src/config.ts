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
    lookbackMs: optionalInt("SENTINEL_LOOKBACK_MS", 2 * 60 * 60 * 1000), // 2h window of recent activity
    pollIntervalMs: optionalInt("SENTINEL_POLL_INTERVAL_MS", 60_000),
    metricsPort: optionalInt("METRICS_PORT", 9102),
  };
}

export type SentinelConfig = ReturnType<typeof loadConfig>;
