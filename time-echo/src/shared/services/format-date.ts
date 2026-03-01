// @GEMS-FUNCTION: formatDate
/**
 * GEMS: formatDate | P2 | ○○ | (date: Date|string)→string | Story-1.0 | 日期格式化工具
 * GEMS-FLOW: PARSE → FORMAT → RETURN
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: format-date.test.ts (內含 describe('formatDate'))
 */

// [STEP] PARSE
function parseDate(input: Date | string): Date {
    if (typeof input === 'string') {
        const parsed = new Date(input);
        if (isNaN(parsed.getTime())) {
            throw new Error(`Invalid date string: ${input}`);
        }
        return parsed;
    }
    return input;
}

// [STEP] FORMAT
/**
 * 格式化為 YYYY-MM-DD
 */
export function formatDate(input: Date | string = new Date()): string {
    const date = parseDate(input);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    // [STEP] RETURN
    return `${year}-${month}-${day}`;
}

/**
 * 格式化為人性化顯示（如「今天」「昨天」或 MM/DD）
 */
export function formatDateDisplay(input: Date | string): string {
    const date = parseDate(input);
    const today = formatDate(new Date());
    const inputStr = formatDate(date);

    if (inputStr === today) return '今天';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (inputStr === formatDate(yesterday)) return '昨天';

    return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 格式化分鐘為「X小時Y分」
 */
export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} 分`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} 小時` : `${h} 小時 ${m} 分`;
}

export default formatDate;
