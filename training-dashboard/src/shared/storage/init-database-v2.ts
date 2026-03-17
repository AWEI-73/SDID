import Database from 'better-sqlite3';
import { initDatabase, getDatabase } from './init-database';
import {
  CREATE_CLASS_NODES_SQL,
  CREATE_NODE_TEMPLATES_SQL,
  CREATE_NODE_TEMPLATE_ITEMS_SQL,
  DEFAULT_TEMPLATE_SEED,
} from '../types/class-node-schema';

/**
 * GEMS: initDatabaseV2 | P0 | ✓✓ | (dbPath?: string)→Database | Story-2.0 | DB 遷移：新增節點相關表
 * GEMS-FLOW: STARTUP→MIGRATE→SEED→READY
 * GEMS-DEPS: [ClassNodeSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] STARTUP — 初始化基礎 DB（呼叫 v1）
// [STEP] MIGRATE — 建立 class_nodes、node_templates、node_template_items 表
// [STEP] SEED — 插入預設基層主管班模板（若尚未存在）
// [STEP] READY — 回傳 db 實例

export function initDatabaseV2(dbPath?: string): Database.Database {
  // [STEP] STARTUP
  const db = initDatabase(dbPath);

  // [STEP] MIGRATE
  db.exec(CREATE_CLASS_NODES_SQL);
  db.exec(CREATE_NODE_TEMPLATES_SQL);
  db.exec(CREATE_NODE_TEMPLATE_ITEMS_SQL);

  // [STEP] SEED
  seedDefaultTemplate(db);

  // [STEP] READY
  return db;
}

function seedDefaultTemplate(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM node_templates WHERE is_default = 1 LIMIT 1').get();
  if (existing) return;

  const insertTemplate = db.prepare(
    'INSERT INTO node_templates (name, description, is_default) VALUES (?, ?, ?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO node_template_items (template_id, name, offset_days, sort_order) VALUES (?, ?, ?, ?)'
  );

  const result = insertTemplate.run(
    DEFAULT_TEMPLATE_SEED.name,
    DEFAULT_TEMPLATE_SEED.description,
    DEFAULT_TEMPLATE_SEED.isDefault ? 1 : 0
  );

  const templateId = result.lastInsertRowid as number;
  for (const item of DEFAULT_TEMPLATE_SEED.items) {
    insertItem.run(templateId, item.name, item.offsetDays, item.sortOrder);
  }
}
