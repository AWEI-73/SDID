import { generateCsvTemplate } from '../lib/generate-csv-template';

/**
 * GEMS: downloadCsvTemplate | P2 | ✓✓ | ()→void | Story-2.3 | 觸發 CSV 範本下載
 * GEMS-FLOW: GENERATE→BLOB→DOWNLOAD
 * GEMS-DEPS: [generateCsvTemplate]
 * GEMS-DEPS-RISK: LOW
 */
// [STEP] GENERATE — 產生 CSV 範本字串
// [STEP] BLOB — 建立 Blob 物件
// [STEP] DOWNLOAD — 觸發瀏覽器下載

export function downloadCsvTemplate(): void {
  // [STEP] GENERATE
  const bom = '\uFEFF';
  const csv = bom + generateCsvTemplate();

  // [STEP] BLOB
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // [STEP] DOWNLOAD
  const a = document.createElement('a');
  a.href = url;
  a.download = 'training-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
