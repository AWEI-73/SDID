import Database from 'better-sqlite3';
import path from 'path';
import { CREATE_TABLE_SQL } from '../types/training-class-schema';

/**
 * GEMS: initDatabase | P0 | ✓✓ | (dbPath?: string)→Database | Story-1.0 | SQLite DB 初始化
 * GEMS-FLOW: STARTUP→SQLITE→READY
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 */
// [STEP] STARTUP — 解析 DB 路徑
// [STEP] SQLITE — 建立連線，執行 CREATE TABLE
// [STEP] READY — 回傳 db 實例

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'training.db');

let _db: Database.Database | null = null;

export function initDatabase(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  // [STEP] STARTUP
  const fs = require('fs');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // [STEP] SQLITE
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(CREATE_TABLE_SQL);

  // [STEP] READY
  _db = db;
  return db;
}

export function getDatabase(): Database.Database {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}
