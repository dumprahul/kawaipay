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
    oracleApiUrl: required("ORACLE_API_URL"),
    // Bech32 `suiprivkey1...` secret key — the wallet that funds every recurring payment.
    payerSecretKey: required("X402_PAYER_SECRET_KEY"),
    intervalMs: optionalInt("X402_PAYER_INTERVAL_MS", 5000),
  };
}

export type X402PayerConfig = ReturnType<typeof loadConfig>;
