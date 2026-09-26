import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client, Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_URL = process.env.POSTGRES_ADMIN_URL ?? "postgres://localhost/postgres";

export async function createTestDatabase(dbName: string): Promise<Pool> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [dbName]);
  await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  const pool = new Pool({ connectionString: url.toString() });

  const migration = readFileSync(join(__dirname, "../../../db/migrations/0001_init.sql"), "utf8");
  await pool.query(migration);
  return pool;
}
