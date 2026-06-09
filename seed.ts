import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "wholesale.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("Initializing database tables...");

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

// --- Seed Users ---
console.log("Seeding users...");

const USERS = [
  {
    email: "test@ghisa.com",
    password: "test1234",
    name: "Test User",
    company: "GHISA Test",
    phone: "",
    role: "customer",
  },
  {
    email: "murat@ghisa.com",
    password: "murat123",
    name: "Murat Goktas",
    company: "GHISA",
    phone: "",
    role: "admin",
  },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (email, password_hash, name, company, phone, role)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (const u of USERS) {
  const hash = hashSync(u.password, 10);
  const result = insertUser.run(
    u.email,
    hash,
    u.name,
    u.company,
    u.phone,
    u.role
  );
  if (result.changes > 0) {
    console.log(`  Created user: ${u.email} (${u.role})`);
  } else {
    console.log(`  User already exists: ${u.email}`);
  }
}

db.close();
console.log("\nSeed complete!");
