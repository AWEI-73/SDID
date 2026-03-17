import { getDatabase } from '../../../shared/storage/init-database';
import type { ClassNode } from '../../../shared/types/class-node-schema';

/**
 * GEMS: getNodesByClass | P1 | ✓✓ | (classId: number)→ClassNode[] | Story-2.1 | 取得班別節點列表
 * GEMS-FLOW: CLASSID→SQLITE→NODES
 * GEMS-DEPS: [ClassNodeSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] CLASSID — 接收班別 ID
// [STEP] SQLITE — 查詢 class_nodes 表
// [STEP] NODES — 回傳排序後的節點列表

function rowToNode(row: Record<string, unknown>): ClassNode {
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

export function getNodesByClass(classId: number): ClassNode[] {
  // [STEP] CLASSID
  const db = getDatabase();
  // [STEP] SQLITE
  const rows = db.prepare(
    'SELECT * FROM class_nodes WHERE class_id = ? ORDER BY sort_order ASC, id ASC'
  ).all(classId) as Record<string, unknown>[];
  // [STEP] NODES
  return rows.map(rowToNode);
}
