// src/modules/GasApi/services/write-status-store.ts

import type { TaskStatus } from '../../../config/core-types';
import { readStatusStore, type StatusMap } from './read-status-store';

/**
 * GEMS: writeStatusStore | P1 | ○○ | (taskId, status)→boolean | Story-3.0 | 狀態回寫
 * GEMS-FLOW: FIND_ROW→UPDATE_STATUS→SAVE_SHEET
 * GEMS-DEPS: [Internal.readStatusStore]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: write-status-store.test.ts
 */
// AC-2.3
export function writeStatusStore(
  taskId: string,
  status: TaskStatus,
  currentMap?: StatusMap
): boolean {
  // [STEP] FIND_ROW
  if (!taskId || !status) return false;

  // [STEP] UPDATE_STATUS
  const map = currentMap ?? readStatusStore();
  map[taskId] = status;

  // [STEP] SAVE_SHEET
  return saveStatusSheetToGas(map);
}

function saveStatusSheetToGas(map: StatusMap): boolean {
  if (typeof SpreadsheetApp === 'undefined') return true; // 測試環境直接回傳成功
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('_status_store');
  if (!sheet) {
    sheet = ss.insertSheet('_status_store');
    sheet.hideSheet();
  }
  const rows = Object.entries(map).map(([taskId, status]) => [taskId, status]);
  sheet.clearContents();
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  }
  return true;
}
