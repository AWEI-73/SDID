import { getDatabase } from '../../../shared/storage/init-database';
import type { NodeTemplate, NodeTemplateItem } from '../../../shared/types/class-node-schema';

export interface TemplateWithItems extends NodeTemplate {
  items: NodeTemplateItem[];
}

/**
 * GEMS: getTemplates | P1 | ✓✓ | ()→TemplateWithItems[] | Story-2.0 | 取得所有節點模板（含項目）
 * GEMS-FLOW: QUERY→MAP→RETURN
 * GEMS-DEPS: [ClassNodeSchema]
 * GEMS-DEPS-RISK: LOW
 */
export function getTemplates(): TemplateWithItems[] {
  const db = getDatabase();
  const templates = db.prepare('SELECT * FROM node_templates ORDER BY is_default DESC, id ASC').all() as Record<string, unknown>[];
  return templates.map(t => {
    const items = db.prepare(
      'SELECT * FROM node_template_items WHERE template_id = ? ORDER BY sort_order ASC'
    ).all(t.id as number) as Record<string, unknown>[];
    return {
      id: t.id as number,
      name: t.name as string,
      description: t.description as string | null,
      isDefault: Boolean(t.is_default),
      createdAt: t.created_at as string,
      items: items.map(i => ({
        id: i.id as number,
        templateId: i.template_id as number,
        name: i.name as string,
        offsetDays: i.offset_days as number,
        sortOrder: i.sort_order as number | null,
      })),
    };
  });
}
