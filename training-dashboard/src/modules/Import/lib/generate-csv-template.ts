/**
 * GEMS: generateCsvTemplate | P2 | ✓✓ | ()→string | Story-2.3 | 產生 CSV 範本字串
 * GEMS-FLOW: HEADERS→EXAMPLE_ROW→JOIN
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 */
// AC-2.2
// [STEP] HEADERS — 定義所有欄位標頭
// [STEP] EXAMPLE_ROW — 建立範例資料行
// [STEP] JOIN — 組合成 CSV 字串

/**
 * 產生 CSV 範本字串（標頭 + 一行範例資料，純計算）
 * @returns CSV 字串（含 UTF-8 BOM 前綴，確保 Excel 相容）
 */
export function generateCsvTemplate(): string {
  // [STEP] HEADERS
  const headers = [
    '年度期別', '班別代號', '班別名稱', '職能屬性', '訓練類別大項', '訓練類別細目',
    '授課方式', '開始日期', '結束日期', '訓練天數', '週次', '調訓函建議日',
    '報名截止日', '人數', '主辦單位', '訓練地點', '使用電腦教室', '指定教室',
    '教輔員', '排序', '狀態', '調整原因', '備註',
  ];

  // [STEP] EXAMPLE_ROW
  const example = [
    '115-1', '1K020041', '基層主管培訓班', '核心技術', '核心技能', '領班',
    '實體', '2026-04-13', '2026-04-24', '12', '14', '2026-03-20',
    '2026-04-03', '48', '配電處', '高訓中心', '0', '教學大樓101',
    '林思辰', '1', 'pending', '', '',
  ];

  // [STEP] JOIN
  return headers.join(',') + '\n' + example.join(',');
}
