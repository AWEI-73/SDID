import { getDatabase } from '../../../shared/storage/init-database';

/**
 * GEMS: deleteNode | P1 | ✓✓ | (id: number)→void | Story-2.1 | 刪除節點
 * GEMS-FLOW: ID→DELETE→RETURN
 * GEMS-DEPS: [ClassNodeSchema]
 * GEMS-DEPS-RISK: LOW
 */
// [STEP] ID — 接收節點 ID
// [STEP] DELETE — 從 SQLite 刪除
// [STEP] RETURN — 確認刪除

export function deleteNode(id: number): void {
  // [STEP] ID
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM class_nodes WHERE id = ?').get(id);
  if (!existing) throw new Error(`找不到節點 ID=${id}`);

  // [STEP] DELETE
  db.prepare('DELETE FROM class_nodes WHERE id = ?').run(id);
  // [STEP] RETURN — void
}
