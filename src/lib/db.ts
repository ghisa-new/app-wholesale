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

    CREATE TABLE IF NOT EXISTS reset_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- admin-set discount overrides; fall back to data/products.json meta
    CREATE TABLE IF NOT EXISTS product_discount (
      handle TEXT PRIMARY KEY,
      discount REAL NOT NULL DEFAULT 0,
      updated_by TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- admin manual on/off-sale overrides on top of the automatic eligibility
    CREATE TABLE IF NOT EXISTS product_override (
      handle TEXT PRIMARY KEY,
      state TEXT NOT NULL,               -- 'on' | 'off'
      updated_by TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event_type TEXT NOT NULL,   -- login | view_product | add_to_cart | view_cart | order
      ref TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL DEFAULT '',
      meta TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id, created_at);

    CREATE TABLE IF NOT EXISTS orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',  -- pending | fulfilled | cancelled
      notes TEXT DEFAULT '',
      total_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'TRY',
      created_at TEXT DEFAULT (datetime('now')),
      status_changed_at TEXT,
      status_changed_by TEXT
    );

    -- one row per size so pending lines can reserve exact variants
    CREATE TABLE IF NOT EXISTS order_lines (
      line_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
      product_handle TEXT NOT NULL,
      product_title TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      size TEXT NOT NULL DEFAULT '',
      sku TEXT NOT NULL DEFAULT '',
      qty INTEGER NOT NULL,
      unit_price REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_lines_sku ON order_lines(sku);
  `);

  // column upgrades on the existing users table (idempotent)
  const cols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("password_plain")) {
    db.exec("ALTER TABLE users ADD COLUMN password_plain TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("curr_acc_code")) {
    db.exec("ALTER TABLE users ADD COLUMN curr_acc_code TEXT NOT NULL DEFAULT ''");
  }
  const lineCols = db.prepare("PRAGMA table_info(order_lines)").all() as Array<{ name: string }>;
  const lineNames = new Set(lineCols.map((c) => c.name));
  if (!lineNames.has("warehouse_code")) {
    db.exec("ALTER TABLE order_lines ADD COLUMN warehouse_code TEXT NOT NULL DEFAULT ''");
  }
  if (!lineNames.has("image_url")) {
    db.exec("ALTER TABLE order_lines ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
  }
  if (!lineNames.has("discount_pct")) {
    db.exec("ALTER TABLE order_lines ADD COLUMN discount_pct REAL NOT NULL DEFAULT 0");
  }
  for (const col of ["whatsapp", "telegram", "contact_email"]) {
    if (!names.has(col)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }
  const orderCols = db.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
  const orderNames = new Set(orderCols.map((c) => c.name));
  if (!orderNames.has("discount_pct")) {
    db.exec("ALTER TABLE orders ADD COLUMN discount_pct REAL NOT NULL DEFAULT 0");
  }
  if (!orderNames.has("discount_amount")) {
    db.exec("ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0");
  }
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
