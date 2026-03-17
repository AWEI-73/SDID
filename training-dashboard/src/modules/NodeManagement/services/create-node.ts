import { getDatabase } from '../../../shared/storage/init-database';
import type { ClassNode, CreateNodeInput } from '../../../shared/types/class-node-schema';

/**
 * GEMS: createNode | P0 | ✓✓ | (input: CreateNodeInput)→ClassNode | Story-2.1 | 新增班別節點
 * GEMS-FLOW: BODY→VALIDATE→INSERT→RETURN
 * GEMS-DEPS: [ClassNodeSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] BODY — 接收輸入
// [STEP] VALIDATE — 驗證必填欄位
// [STEP] INSERT — 寫入 SQLite
// [STEP] RETURN — 回傳新節點

export function createNode(input: CreateNodeInput): ClassNode {
  // [STEP] BODY
  const { classId, name, offsetDays, sortOrder = null, notes = null } = input;

  // [STEP] VALIDATE
  if (!classId || !name || offsetDays === undefined) {
    throw new Error('classId、name、offsetDays 為必填');
  }

  // [STEP] INSERT
  const db = getDatabase();
  const result = db.prepare(
    `INSERT INTO class_nodes (class_id, name, offset_days, sort_order, notes)
     VALUES (?, ?, ?, ?, ?)`
  ).run(classId, name, offsetDays, sortOrder, notes);

  // [STEP] RETURN
  const row = db.prepare('SELECT * FROM class_nodes WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
  return {
    id: row.id as number,
    classId: row.class_id as number,
    name: row.name as string,
    offsetDays: row.offset_days as number,
    sortOrder: row.sort_order as number | null,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
