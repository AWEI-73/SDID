/**
 * GEMS: formatDateDisplay | P2 | ✓✓ | (isoDate: string)→string | Story-1.0 | 日期格式化 ISO8601 → 民國年
 * GEMS-FLOW: PARSE→CONVERT→FORMAT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 */
// AC-1.1
// [STEP] PARSE — 解析 ISO8601 日期
// [STEP] CONVERT — 西元年轉民國年（-1911）
// [STEP] FORMAT — 格式化為 YYY/MM/DD

export function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '—';
  // [STEP] PARSE
  const [year, month, day] = isoDate.split('-');
  // [STEP] CONVERT
  const rocYear = parseInt(year) - 1911;
  // [STEP] FORMAT
  return `${rocYear}/${month}/${day}`;
}
