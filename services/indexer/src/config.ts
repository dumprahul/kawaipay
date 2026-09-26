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
    graphqlUrl: required("SUI_GRAPHQL_URL"),
    network: process.env.SUI_NETWORK ?? "testnet",
    metricsPort: optionalInt("METRICS_PORT", 9103),
  };
}

export type IndexerConfig = ReturnType<typeof loadConfig>;
