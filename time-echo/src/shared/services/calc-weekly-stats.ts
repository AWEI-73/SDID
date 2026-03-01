// @GEMS-FUNCTION: calcWeeklyStats
/**
 * GEMS: calcWeeklyStats | P1 | ○○ | (entries: TimeEntry[], weekKey: string)→WeeklyReport | Story-1.0 | 週報統計聚合
 * GEMS-FLOW: LOAD_ENTRIES → FILTER → AGGREGATE → RETURN
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: calc-weekly-stats.test.ts (內含 describe('calcWeeklyStats'))
 */

import type { TimeEntry, WeeklyReport, Category, Mood } from '../types/core-types';
import { CATEGORY_LIST, MOOD_LIST } from '../types/app-constants';
import { getWeekRange } from './get-week-key';

// [STEP] LOAD_ENTRIES
export function calcWeeklyStats(entries: TimeEntry[], weekKey: string): WeeklyReport {

    // [STEP] FILTER
    function filterByWeek(ents: TimeEntry[]): TimeEntry[] {
        const { start, end } = getWeekRange(weekKey);
        return ents.filter((e) => e.date >= start && e.date <= end);
    }
    const filtered = filterByWeek(entries);

    // 總時間
    const totalMinutes = filtered.reduce((sum, e) => sum + e.duration, 0);

    // 分類分布
    const categoryBreakdown = CATEGORY_LIST.reduce((acc, cat) => {
        acc[cat] = filtered
            .filter((e) => e.category === cat)
            .reduce((s, e) => s + e.duration, 0);
        return acc;
    }, {} as Record<Category, number>);

    // 心情趨勢（每天一個，取當天最後一筆）
    const { start } = getWeekRange(weekKey);
    const moodTrend: (Mood | null)[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayEntries = filtered
            .filter((e) => e.date === dayStr)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return dayEntries.length > 0 ? dayEntries[0].mood : null;
    });

    // [STEP] AGGREGATE
    const activityMap: Record<string, number> = {};
    filtered.forEach((e) => {
        activityMap[e.activity] = (activityMap[e.activity] ?? 0) + e.duration;
    });
    const topActivity = Object.entries(activityMap).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '';

    // [STEP] RETURN
    return {
        weekKey,
        totalMinutes,
        categoryBreakdown,
        moodTrend,
        topActivity,
        generatedAt: new Date().toISOString(),
    };
}

export default calcWeeklyStats;
