// src/modules/Dashboard/lib/compute-node-dates.ts

/**
 * GEMS: computeNodeDates | P0 | ✓✓ | (startDate, params)→TaskNodeDate[] | Story-2.0 | 節點日期計算
 * GEMS-FLOW: INPUT_START_DATE→CALC_OFFSET→CALC_ALERT→RETURN
 * GEMS-DEPS: [shared/types]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: compute-node-dates.test.ts
 */
// AC-1.0
export function computeNodeDates(
  startDate: string,
  params: Array<{ taskCode: string; offsetDays: number; earlyAlertDays: number }>
): Array<{ taskCode: string; dueDate: string; alertDate: string }> {
  // [STEP] INPUT_START_DATE
  // 用 UTC 解析避免 timezone 偏差（"2026-04-13" 在 UTC-5 會被解成 4/12）
  const [y, m, d] = startDate.split('-').map(Number);
  const startMs = Date.UTC(y, m - 1, d);

  // [STEP] CALC_OFFSET
  return params.map(p => {
    const dueMs = startMs - p.offsetDays * 86400000;
    const alertMs = dueMs - p.earlyAlertDays * 86400000;

    // [STEP] CALC_ALERT + RETURN
    const toISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    return {
      taskCode: p.taskCode,
      dueDate: toISO(dueMs),
      alertDate: toISO(alertMs),
    };
  });
}

// 型別統一來源: core-types.ts（禁止在此重複定義）
export type { TrainingClass, TaskNode, NodeParamConfig } from '../../../config/core-types';
