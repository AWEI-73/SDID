/**
 * GEMS: ClassNodeSchema | P0 | ✓✓ | ()→ClassNode | Story-2.0 | 節點型別定義與 SQLite Schema
 * GEMS-FLOW: DEFINE→FREEZE→EXPORT
 * GEMS-DEPS: [TrainingClassSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// AC-2.0
// [STEP] DEFINE — 定義 ClassNode、NodeTemplate、NodeTemplateItem 型別
// [STEP] FREEZE — 凍結 DDL 常數
// [STEP] EXPORT — 匯出所有型別與 DDL

export interface ClassNode {
  id: number;
  // @GEMS-FIELD: INTEGER, NOT NULL, FK → training_classes.id
  classId: number;
  // @GEMS-FIELD: VARCHAR(100), NOT NULL
  name: string;
  // @GEMS-FIELD: INTEGER, NOT NULL — 相對開訓日偏移天數（負數 = 開訓前）
  offsetDays: number;
  // @GEMS-FIELD: INTEGER
  sortOrder: number | null;
  // @GEMS-FIELD: TEXT
  notes: string | null;
  // @GEMS-FIELD: TIMESTAMP, NOT NULL
  createdAt: string;
  // @GEMS-FIELD: TIMESTAMP, NOT NULL
  updatedAt: string;
}

export interface NodeTemplate {
  id: number;
  // @GEMS-FIELD: VARCHAR(100), NOT NULL
  name: string;
  // @GEMS-FIELD: TEXT
  description: string | null;
  // @GEMS-FIELD: INTEGER, DEFAULT 0
  isDefault: boolean;
  // @GEMS-FIELD: TIMESTAMP, NOT NULL
  createdAt: string;
}

export interface NodeTemplateItem {
  id: number;
  // @GEMS-FIELD: INTEGER, NOT NULL, FK → node_templates.id
  templateId: number;
  // @GEMS-FIELD: VARCHAR(100), NOT NULL
  name: string;
  // @GEMS-FIELD: INTEGER, NOT NULL
  offsetDays: number;
  // @GEMS-FIELD: INTEGER
  sortOrder: number | null;
}

export type CreateNodeInput = Omit<ClassNode, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateNodeInput = Partial<Pick<ClassNode, 'name' | 'offsetDays' | 'sortOrder' | 'notes'>>;

export interface UpcomingNode {
  node: ClassNode;
  className: string;
  dueDate: string;
  daysUntil: number;
}

export const CREATE_CLASS_NODES_SQL = `
CREATE TABLE IF NOT EXISTS class_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES training_classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  offset_days INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_NODE_TEMPLATES_SQL = `
CREATE TABLE IF NOT EXISTS node_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_NODE_TEMPLATE_ITEMS_SQL = `
CREATE TABLE IF NOT EXISTS node_template_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES node_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  offset_days INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER
)`;

/** 基層主管班預設節點模板種子資料 */
export const DEFAULT_TEMPLATE_SEED = {
  name: '基層主管班',
  description: '基層主管培訓班標準流程節點',
  isDefault: true,
  items: [
    { name: '取得單位員額', offsetDays: -60, sortOrder: 1 },
    { name: '收集各單位名額', offsetDays: -45, sortOrder: 2 },
    { name: '發送調訓函', offsetDays: -30, sortOrder: 3 },
    { name: '填寫傳知單', offsetDays: -21, sortOrder: 4 },
    { name: '確認報名人數', offsetDays: -14, sortOrder: 5 },
    { name: '準備 A3 海報', offsetDays: -7, sortOrder: 6 },
    { name: '開訓', offsetDays: 0, sortOrder: 7 },
  ],
};
