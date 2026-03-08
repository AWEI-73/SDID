// src/modules/GasApi/services/read-status-store.ts

import type { TaskStatus } from '../../../config/core-types';

/** 狀態儲存格式：taskId → status */
export type StatusMap = Record<string, TaskStatus>;

/**
 * GEMS: readStatusStore | P1 | ○○ | (sheetData?)→StatusMap | Story-3.0 | 狀態儲存讀取
 * GEMS-FLOW: OPEN_HIDDEN_SHEET→READ_MAP→RETURN
 * GEMS-DEPS: [Module.shared]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: read-status-store.test.ts
 */
// AC-2.2
export function readStatusStore(sheetData?: string[][]): StatusMap {
  // [STEP] OPEN_HIDDEN_SHEET
  const rows = sheetData ?? getStatusSheetFromGas();

  // [STEP] READ_MAP
  const map: StatusMap = {};
  for (const row of rows) {
    const taskId = row[0]?.trim();
    const status = row[1]?.trim() as TaskStatus;
    if (taskId && (status === 'pending' || status === 'done' || status === 'overdue')) {
      map[taskId] = status;
    }
  }

  // [STEP] RETURN
  return map;
}

function getStatusSheetFromGas(): string[][] {
  if (typeof SpreadsheetApp === 'undefined') return [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('_status_store');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().map(row =>
    row.map(cell => String(cell))
  );
}
