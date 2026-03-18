import { getAllClasses } from '../classes';
import { getNodesByClass } from '../nodes';
import type { ClassWithConflict, UpcomingNode, DashboardFilters } from './types';

export function getClassesWithConflicts(filters: DashboardFilters = {}): ClassWithConflict[] {
  const allClasses = getAllClasses();
  let classes = allClasses;

  if (filters.search) {
    const q = filters.search.toLowerCase();
    classes = classes.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  }
  if (filters.status) classes = classes.filter(c => c.status === filters.status);
  if (filters.year_term) classes = classes.filter(c => c.year_term === filters.year_term);

  return classes.map(cls => {
    const hasRoomConflict = cls.room
      ? allClasses.some(other =>
          other.id !== cls.id &&
          other.room === cls.room &&
          other.start_date <= cls.end_date &&
          other.end_date >= cls.start_date
        )
      : false;

    const hasDateConflict = allClasses.some(other =>
      other.id !== cls.id &&
      other.start_date <= cls.end_date &&
      other.end_date >= cls.start_date
    );

    return { ...cls, hasRoomConflict, hasDateConflict };
  });
}

export function getUpcomingNodes(days = 7): UpcomingNode[] {
  const classes = getAllClasses();
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);
  const todayStr = today.toISOString().split('T')[0];
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const result: UpcomingNode[] = [];

  for (const cls of classes) {
    const nodes = getNodesByClass(cls.id, cls.start_date);
    for (const node of nodes) {
      if (!node.actual_date) continue;
      if (node.actual_date >= todayStr && node.actual_date <= cutoffStr) {
        const daysUntil = Math.ceil(
          (new Date(node.actual_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        result.push({ ...node, class_name: cls.name, days_until: daysUntil });
      }
    }
  }

  return result.sort((a, b) => a.actual_date!.localeCompare(b.actual_date!));
}
