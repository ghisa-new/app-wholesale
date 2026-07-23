import { getDb, queryOne, run } from "./db";

/** Tiny key/value settings store (register token etc.). */

function ensure() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function getSetting(key: string, fallback = ""): string {
  ensure();
  return queryOne<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key])?.value ?? fallback;
}

export function setSetting(key: string, value: string, by: string) {
  ensure();
  run(
    `INSERT INTO settings (key, value, updated_by, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
       updated_by = excluded.updated_by, updated_at = datetime('now')`,
    [key, value, by]
  );
}

export const REGISTER_TOKEN_KEY = "register_token";
export const REGISTER_TOKEN_DEFAULT = "GHSWH1991";

export function getRegisterToken(): string {
  return getSetting(REGISTER_TOKEN_KEY, REGISTER_TOKEN_DEFAULT);
}
