// src/modules/Dashboard/lib/resolve-task-status.ts

/**
 * GEMS: resolveTaskStatus | P1 | ✓✓ | (args)→TaskStatus | Story-2.0 | 任務狀態判定
 * GEMS-FLOW: INPUT_DATES→COMPARE_TODAY→RETURN_STATUS
 * GEMS-DEPS: [Internal.computeNodeDates]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: resolve-task-status.test.ts
 */
// AC-1.1
export function resolveTaskStatus(args: {
  dueDate: string;
  alertDate: string;
  today: string;
  isDone: boolean;
}): 'pending' | 'done' | 'overdue' {
  // [STEP] INPUT_DATES
  const { dueDate, alertDate, today, isDone } = args;

  // [STEP] COMPARE_TODAY
  if (isDone) return 'done';
  if (today > dueDate) return 'overdue';

  // [STEP] RETURN_STATUS
  return 'pending';
}

// 型別統一來源: core-types.ts（禁止在此重複定義）
export type { TrainingClass, TaskNode, NodeParamConfig } from '../../../config/core-types';
