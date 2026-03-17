/**
 * GEMS: calcNodeDate | P2 | ✓✓ | (startDate: string, offsetDays: number)→string | Story-2.1 | 計算節點實際日期
 * GEMS-FLOW: PARSE→OFFSET→FORMAT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 */
// AC-2.0
// [STEP] PARSE — 解析 ISO8601 開訓日
// [STEP] OFFSET — 加上偏移天數
// [STEP] FORMAT — 回傳 ISO8601 字串

/**
 * 根據班別開訓日 + 偏移天數計算節點實際日期（純計算）
 * @param startDate - 班別開訓日 ISO8601 (e.g. "2026-04-13")
 * @param offsetDays - 偏移天數，負數 = 開訓前 N 天
 * @returns ISO8601 日期字串 (e.g. "2026-04-06")
 */
export function calcNodeDate(startDate: string, offsetDays: number): string {
  // [STEP] PARSE — 用本地時間解析，避免 UTC 時區偏移問題
  const [year, month, day] = startDate.split('-').map(Number);
  const d = new Date(year, month - 1, day); // 本地時間，不走 UTC
  // [STEP] OFFSET
  d.setDate(d.getDate() + offsetDays);
  // [STEP] FORMAT — 用本地時間格式化，不用 toISOString()
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
