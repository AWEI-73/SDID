import { getDatabase } from '../../../shared/storage/init-database';

/**
 * GEMS: deleteClass | P1 | ✓✓ | (id: number)→void | Story-1.3 | 刪除班別
 * GEMS-FLOW: ID→DELETE→RETURN
 * GEMS-DEPS: [TrainingClassSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] ID — 確認記錄存在
// [STEP] DELETE — 從 SQLite 刪除
// [STEP] RETURN — 回傳操作結果

export function deleteClass(id: number): void {
  const db = getDatabase();

  // [STEP] ID
  const existing = db.prepare('SELECT id FROM training_classes WHERE id = ?').get(id);
  if (!existing) throw new Error(`班別 ${id} 不存在`);

  // [STEP] DELETE
  db.prepare('DELETE FROM training_classes WHERE id = ?').run(id);

  // [STEP] RETURN (void)
}
