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
    facilitatorUrl: process.env.FACILITATOR_URL ?? "https://sui-facilitator.onrender.com",
    network: process.env.X402_NETWORK ?? "sui:testnet",
    usdcType: required("USDC_TYPE"),
    payTo: required("PAY_TO"),
    priceBaseUnits: optionalInt("PRICE_BASE_UNITS", 1000), // 0.001 USDC per verdict request
    maxTimeoutSeconds: optionalInt("MAX_TIMEOUT_SECONDS", 60),
    port: optionalInt("PORT", 8081),
  };
}

export type OracleApiConfig = ReturnType<typeof loadConfig>;
