/**
 * GEMS: calcDaysBetween | P2 | ✓✓ | (startDate: string, endDate: string)→number | Story-1.0 | 計算兩日期間隔天數
 * GEMS-FLOW: PARSE_DATES→CALC_DIFF→RETURN
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 */
// AC-1.0
// [STEP] PARSE_DATES — 解析 ISO8601 日期字串
// [STEP] CALC_DIFF — 計算毫秒差轉換為天數
// [STEP] RETURN — 回傳整數天數

export function calcDaysBetween(startDate: string, endDate: string): number {
  // [STEP] PARSE_DATES
  const start = new Date(startDate);
  const end = new Date(endDate);
  // [STEP] CALC_DIFF
  const diffMs = end.getTime() - start.getTime();
  // [STEP] RETURN
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
