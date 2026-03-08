// src/modules/GasApi/lib/expand-task-nodes.ts

import type { TrainingClass, TaskNode, NodeParamConfig } from '../../../config/core-types';

/**
 * GEMS: expandTaskNodes | P1 | ○○ | (classes, params)→TaskNode[] | Story-3.0 | 節點日期展開
 * GEMS-FLOW: LOAD_PARAMS→ITERATE_CLASSES→CALC_DATES→RETURN
 * GEMS-DEPS: [Internal.readSheetClasses]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: expand-task-nodes.test.ts
 */
// AC-2.1
export function expandTaskNodes(
  classes: TrainingClass[],
  params: NodeParamConfig[]
): TaskNode[] {
  // [STEP] LOAD_PARAMS
  if (params.length === 0) return [];

  // [STEP] ITERATE_CLASSES
  const nodes: TaskNode[] = [];
  for (const cls of classes) {
    for (const param of params) {
      // [STEP] CALC_DATES
      const startMs = parseRocDate(cls.startDate);
      if (startMs === null) continue;

      const dueMs = startMs - param.offsetDays * 86400000;
      const alertMs = dueMs - param.earlyAlertDays * 86400000;

      const dueDate = toIsoDate(dueMs);
      const alertDate = toIsoDate(alertMs);

      nodes.push({
        taskId: `${cls.classId}_${param.taskCode}`,
        classId: cls.classId,
        taskCode: param.taskCode,
        taskName: param.taskName,
        dueDate,
        alertDate,
        status: 'pending',
      });
    }
  }

  // [STEP] RETURN
  return nodes;
}

/** 解析民國年格式 "115/04/13" → Unix ms（UTC），失敗回傳 null */
export function parseRocDate(rocDate: string): number | null {
  const m = rocDate.match(/^(\d+)\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10) + 1911;
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const d = new Date(Date.UTC(year, month, day));
  return isNaN(d.getTime()) ? null : d.getTime();
}

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().split('T')[0];
}
