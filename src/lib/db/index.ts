import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "blinks-vault", "blinks.db");

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;

  ensureDir(DB_PATH);
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  _db = drizzle(sqlite, { schema });

  // Run migrations
  const migrationsPath = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsPath)) {
    migrate(_db, { migrationsFolder: migrationsPath });
  }

  return _db;
}

export { schema };
