import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "sandbox.db");

// ensure data dir exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL,
      description TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS verified_creators (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      nullifier    TEXT NOT NULL UNIQUE,
      verified_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS creator_links (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
      creator_id  INTEGER NOT NULL REFERENCES verified_creators(id),
      slug        TEXT    NOT NULL UNIQUE,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(campaign_id, creator_id)
    );

    CREATE TABLE IF NOT EXISTS used_nonces (
      nonce      TEXT NOT NULL,
      nullifier  TEXT NOT NULL,
      used_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (nonce, nullifier)
    );
  `);

  // seed campaigns if empty
  const count = (db.prepare("SELECT COUNT(*) as n FROM campaigns").get() as { n: number }).n;
  if (count === 0) {
    const insert = db.prepare("INSERT INTO campaigns (name, description) VALUES (?, ?)");
    insert.run("Campaign A", "Launch campaign for the Minimal Linen Collection.");
    insert.run("Campaign B", "Spring drop — verified attention rewards.");
    insert.run("Campaign C", "Collab campaign — exclusive creator slots.");
  }
}
