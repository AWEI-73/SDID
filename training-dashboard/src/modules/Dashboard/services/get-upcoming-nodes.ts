import { getDatabase } from '../../../shared/storage/init-database';
import type { ClassNode } from '../../../shared/types/class-node-schema';
import type { UpcomingNode } from '../../../shared/types/class-node-schema';
import { calcNodeDate } from '../../NodeManagement/lib/calc-node-date';

/**
 * GEMS: getUpcomingNodes | P1 | ✓✓ | (withinDays: number)→UpcomingNode[] | Story-2.2 | 取得近期待辦節點
 * GEMS-FLOW: DAYS→SQLITE→CALC_DATES→FILTER→SORT
 * GEMS-DEPS: [ClassNodeSchema, calcNodeDate]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] DAYS — 接收查詢天數範圍
// [STEP] SQLITE — 查詢所有節點與班別
// [STEP] CALC_DATES — 計算每個節點的實際日期
// [STEP] FILTER — 過濾出範圍內的節點
// [STEP] SORT — 依實際日期排序

interface ClassRow {
  id: number;
  class_name: string;
  start_date: string;
}

interface NodeRow {
  id: number;
  class_id: number;
  name: string;
  offset_days: number;
  sort_order: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function getUpcomingNodes(withinDays: number = 7): UpcomingNode[] {
  // [STEP] DAYS
  const db = getDatabase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today.getTime() + withinDays * 86400000);

  // [STEP] SQLITE
  const classes = db.prepare('SELECT id, class_name, start_date FROM training_classes').all() as ClassRow[];
  const classMap = new Map(classes.map(c => [c.id, c]));

  const nodes = db.prepare('SELECT * FROM class_nodes').all() as NodeRow[];

  // [STEP] CALC_DATES + FILTER
  const upcoming: UpcomingNode[] = [];
  for (const node of nodes) {
    const cls = classMap.get(node.class_id);
    if (!cls) continue;

    const dueDate = calcNodeDate(cls.start_date, node.offset_days);
    // 用本地時間解析，避免 UTC 時區偏移
    const [dy, dm, dd] = dueDate.split('-').map(Number);
    const due = new Date(dy, dm - 1, dd);
    if (due < today || due > limit) continue;

    const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);
    const classNode: ClassNode = {
      id: node.id,
      classId: node.class_id,
      name: node.name,
      offsetDays: node.offset_days,
      sortOrder: node.sort_order,
      notes: node.notes,
      createdAt: node.created_at,
      updatedAt: node.updated_at,
    };
    upcoming.push({ node: classNode, className: cls.class_name, dueDate, daysUntil });
  }

  // [STEP] SORT
  return upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
