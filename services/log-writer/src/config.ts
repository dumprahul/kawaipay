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
    logSecret: process.env.LOG_SECRET ?? "dev-log-secret-change-me",
    logStoreDir: process.env.LOG_STORE_DIR ?? "./data/logs",
    pollIntervalMs: optionalInt("LOG_WRITER_POLL_INTERVAL_MS", 30_000),
    metricsPort: optionalInt("METRICS_PORT", 9104),
  };
}

export type LogWriterConfig = ReturnType<typeof loadConfig>;
