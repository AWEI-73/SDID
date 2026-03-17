import { getDatabase } from '../../../shared/storage/init-database';
import type { ClassNode, UpdateNodeInput } from '../../../shared/types/class-node-schema';

/**
 * GEMS: updateNode | P1 | ✓✓ | (id: number, input: UpdateNodeInput)→ClassNode | Story-2.1 | 更新節點
 * GEMS-FLOW: ID→BODY→UPDATE→RETURN
 * GEMS-DEPS: [ClassNodeSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] ID — 接收節點 ID
// [STEP] BODY — 接收更新欄位
// [STEP] UPDATE — 更新 SQLite
// [STEP] RETURN — 回傳更新後節點

export function updateNode(id: number, input: UpdateNodeInput): ClassNode {
  // [STEP] ID + BODY
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM class_nodes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) throw new Error(`找不到節點 ID=${id}`);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.offsetDays !== undefined) { fields.push('offset_days = ?'); values.push(input.offsetDays); }
  if (input.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(input.sortOrder); }
  if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }

  if (fields.length === 0) throw new Error('沒有提供任何更新欄位');

  // [STEP] UPDATE
  fields.push('updated_at = datetime(\'now\')');
  values.push(id);
  db.prepare(`UPDATE class_nodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // [STEP] RETURN
  const row = db.prepare('SELECT * FROM class_nodes WHERE id = ?').get(id) as Record<string, unknown>;
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
