import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "wholesale.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initTables(_db);
  }
  return _db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, params: unknown[] = []) {
  return getDb().prepare(sql).run(...params);
}
