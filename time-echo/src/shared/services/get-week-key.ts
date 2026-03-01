// @GEMS-FUNCTION: getWeekKey
/**
 * GEMS: getWeekKey | P2 | ○○ | (date: Date|string)→string | Story-1.0 | 週次鍵值計算
 * GEMS-FLOW: PARSE_DATE → CALC_WEEK → RETURN
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: get-week-key.test.ts (內含 describe('getWeekKey'))
 */

// [STEP] PARSE_DATE
function parseInput(input: Date | string = new Date()): Date {
    if (typeof input === 'string') {
        const parsed = new Date(input);
        if (isNaN(parsed.getTime())) throw new Error(`Invalid date: ${input}`);
        return parsed;
    }
    return input;
}

// [STEP] CALC_WEEK
/**
 * 計算 ISO 8601 週次 (週一為週第一天)
 * 返回格式: "YYYY-WWW" (e.g. "2026-W08")
 */
export function getWeekKey(input: Date | string = new Date()): string {
    const date = parseInput(input);

    // 複製日期，避免修改原始值
    const d = new Date(date.getTime());

    // 設定為該週的週四（ISO 8601：週四所在年 = 週所在年）
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));

    // 計算年份
    const year = d.getFullYear();

    // 計算該年第一週的週四
    const week1 = new Date(year, 0, 4);
    week1.setDate(week1.getDate() + 3 - ((week1.getDay() + 6) % 7));

    // 計算週次
    const weekNumber = 1 + Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );

    // [STEP] RETURN
    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * 取得週次的開始日期（週一）和結束日期（週日）
 */
export function getWeekRange(weekKey: string): { start: string; end: string } {
    const [yearStr, weekStr] = weekKey.split('-W');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);

    // 找到該年的週一
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = (jan4.getDay() + 6) % 7; // 0=Mon
    const week1Monday = new Date(jan4);
    week1Monday.setDate(jan4.getDate() - dayOfWeek);

    const monday = new Date(week1Monday);
    monday.setDate(week1Monday.getDate() + (week - 1) * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    return { start: fmt(monday), end: fmt(sunday) };
}

export default getWeekKey;
