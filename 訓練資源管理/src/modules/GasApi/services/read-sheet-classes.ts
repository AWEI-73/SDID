// src/modules/GasApi/services/read-sheet-classes.ts

import type { TrainingClass } from '../../../config/core-types';

/**
 * GEMS: readSheetClasses | P0 | ○○ | ()→TrainingClass[] | Story-3.0 | 工作表資料讀取
 * GEMS-FLOW: OPEN_SHEET→READ_ROWS→PARSE_HEADER→RETURN_OBJECTS
 * GEMS-DEPS: [Module.shared]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: read-sheet-classes.test.ts
 */
// AC-2.0
export function readSheetClasses(
  sheetData?: string[][]
): TrainingClass[] {
  // [STEP] OPEN_SHEET
  // 允許注入測試資料（GAS 環境外使用）
  const rows = sheetData ?? getSheetDataFromGas();

  // [STEP] READ_ROWS
  if (rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;

  // [STEP] PARSE_HEADER
  const headers = headerRow.map(h => h.trim());
  const idx = (name: string) => headers.indexOf(name);

  // [STEP] RETURN_OBJECTS
  return dataRows
    .filter(row => row.some(cell => cell.trim() !== ''))
    .map(row => ({
      classId: row[idx('classId')] ?? row[0] ?? '',
      yearPeriod: row[idx('yearPeriod')] ?? row[1] ?? '',
      classCode: row[idx('classCode')] ?? row[2] ?? '',
      className: row[idx('className')] ?? row[3] ?? '',
      organizer: row[idx('organizer')] ?? row[4] ?? '',
      venue: row[idx('venue')] ?? row[5] ?? '',
      startDate: row[idx('startDate')] ?? row[6] ?? '',
      endDate: row[idx('endDate')] ?? row[7] ?? '',
      useComputerRoom: (row[idx('useComputerRoom')] ?? '') === 'true',
      headcount: parseInt(row[idx('headcount')] ?? row[9] ?? '0', 10),
      trainingDays: parseInt(row[idx('trainingDays')] ?? row[10] ?? '0', 10),
      deliveryMode: row[idx('deliveryMode')] ?? row[11] ?? '',
      canDelegate: (row[idx('canDelegate')] ?? '') === 'true',
    }));
}

/** GAS 環境下讀取 Spreadsheet（僅在 GAS 執行時有效） */
export function getSheetDataFromGas(): string[][] {
  if (typeof SpreadsheetApp === 'undefined') return [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('年度訓練計畫總表');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().map(row =>
    row.map(cell => String(cell))
  );
}
