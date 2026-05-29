import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
const dbPath = process.env.DB_PATH || './data/validator.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
export const db: DatabaseType = new Database(dbPath);
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schemas (
      name TEXT PRIMARY KEY,
      json_schema TEXT NOT NULL,
      zod_source TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schema_name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      strategy TEXT NOT NULL,
      success INTEGER NOT NULL,
      total_attempts INTEGER NOT NULL,
      total_tokens INTEGER NOT NULL,
      total_latency_ms INTEGER NOT NULL,
      correction_needed INTEGER NOT NULL,
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schema_name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      strategy TEXT NOT NULL,
      attempts TEXT NOT NULL,
      final_error TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS strategy_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schema_name TEXT NOT NULL,
      strategy TEXT NOT NULL,
      success INTEGER NOT NULL,
      attempt_number INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('[DB] Initialized at', dbPath);
}
