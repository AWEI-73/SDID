import { getDatabase } from '../../../shared/storage/init-database';
import type { ClassNode } from '../../../shared/types/class-node-schema';

/**
 * GEMS: applyTemplate | P1 | ✓✓ | (classId: number, templateId: number)→ClassNode[] | Story-2.0 | 套用節點模板到班別
 * GEMS-FLOW: VALIDATE→QUERY_ITEMS→INSERT→RETURN
 * GEMS-DEPS: [ClassNodeSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
export function applyTemplate(classId: number, templateId: number): ClassNode[] {
  const db = getDatabase();

  const template = db.prepare('SELECT id FROM node_templates WHERE id = ?').get(templateId);
  if (!template) throw new Error('找不到模板');

  const cls = db.prepare('SELECT id FROM training_classes WHERE id = ?').get(classId);
  if (!cls) throw new Error('找不到班別');

  const items = db.prepare(
    'SELECT * FROM node_template_items WHERE template_id = ? ORDER BY sort_order ASC'
  ).all(templateId) as Record<string, unknown>[];

  const insert = db.prepare(
    `INSERT INTO class_nodes (class_id, name, offset_days, sort_order, notes)
     VALUES (?, ?, ?, ?, NULL)`
  );

  const inserted: ClassNode[] = [];
  for (const item of items) {
    const result = insert.run(classId, item.name, item.offset_days, item.sort_order);
    const row = db.prepare('SELECT * FROM class_nodes WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
    inserted.push({
      id: row.id as number,
      classId: row.class_id as number,
      name: row.name as string,
      offsetDays: row.offset_days as number,
      sortOrder: row.sort_order as number | null,
      notes: null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }

  return inserted;
}
