import { Pool, type PoolConfig } from "pg";

/**
 * Builds the one Pool config every service's entrypoint uses. Local dev/test Postgres
 * (localhost/127.0.0.1) talks plaintext; anything else — Supabase, RDS, any managed
 * provider — gets SSL turned on automatically, since that's what every managed Postgres
 * offering requires and none of them hand out a CA cert node-postgres can verify against.
 * `rejectUnauthorized: false` accepts the provider's own cert chain without pinning it —
 * fine here because the connection string itself (delivered out of band, never over
 * plain HTTP) is the actual secret; this only prevents a passive network eavesdropper,
 * which TLS with an unpinned cert still does.
 */
export function createPgPool(connectionString: string, overrides: PoolConfig = {}): Pool {
  const isLocal = /^(postgres(?:ql)?:\/\/)?[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
  return new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    ...overrides,
  });
}
