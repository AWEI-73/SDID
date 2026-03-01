// @GEMS-FUNCTION: CoreTypes
/**
 * GEMS: CoreTypes | P0 | ○○ | ()→TypeDefs | Story-1.0 | 核心型別定義
 * GEMS-FLOW: DEFINE → FREEZE → EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: core-types.test.ts (內含 describe('CoreTypes'))
 */

// [STEP] DEFINE
export type Category = 'WORK' | 'LEARNING' | 'HEALTH' | 'LEISURE' | 'OTHER';
export type Mood = 'GREAT' | 'GOOD' | 'NEUTRAL' | 'TIRED' | 'STRESSED';

export interface TimeEntry {
    id: string;
    date: string; // YYYY-MM-DD
    activity: string;
    duration: number; // minutes
    category: Category;
    mood: Mood;
    note?: string;
    createdAt: string; // ISO8601
}

export interface WeeklyReport {
    weekKey: string; // YYYY-WW
    totalMinutes: number;
    categoryBreakdown: Record<Category, number>;
    moodTrend: (Mood | null)[];
    topActivity: string;
    generatedAt: string;
}

export interface AppState {
    entries: TimeEntry[];
    currentDate: string;
}

// [STEP] FREEZE - All types are TypeScript readonly by convention
// [STEP] EXPORT - All types exported above
