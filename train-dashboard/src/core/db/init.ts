import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(path.join(process.cwd(), 'train-dashboard.db'));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    seedTemplates(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS training_classes (
      id TEXT PRIMARY KEY,
      year_term TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      training_type TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER DEFAULT 0,
      location TEXT DEFAULT '',
      room TEXT DEFAULT '',
      capacity INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planned',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_nodes (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES training_classes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      offset_days INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS node_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS node_template_items (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES node_templates(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      offset_days INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );
  `);
}

function seedTemplates(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM node_templates WHERE is_default = 1').get();
  if (existing) return;

  const templateId = 'default-template-001';
  db.prepare('INSERT INTO node_templates (id, name, is_default) VALUES (?, ?, 1)')
    .run(templateId, '基層主管班');

  const items = [
    { name: '調訓函發文', offset_days: -30 },
    { name: '報名截止', offset_days: -14 },
    { name: '名單確認', offset_days: -7 },
    { name: '教材準備', offset_days: -3 },
    { name: '開訓典禮', offset_days: 0 },
    { name: '結訓典禮', offset_days: 4 },
    { name: '成績繳交', offset_days: 14 },
  ];

  const stmt = db.prepare(
    'INSERT INTO node_template_items (id, template_id, name, offset_days, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  items.forEach((item, i) => {
    stmt.run(`tpl-item-${i + 1}`, templateId, item.name, item.offset_days, i);
  });
}
