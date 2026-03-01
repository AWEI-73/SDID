// @GEMS-FUNCTION: calcPriorityScore
/**
 * GEMS: calcPriorityScore | P0 | ○○ | (importance: number, deadline: string)→number | Story-2.1 | 計算優先級分數
 * GEMS-FLOW: PARSE_DATE → CALC_DAYS → WEIGHT_SCORE → RETURN
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: calc-priority-score.test.ts
 */
export function calcPriorityScore(importance: number, deadline: string): number {
    // [STEP] PARSE_DATE
    const deadlineDate = new Date(deadline);
    const now = new Date();

    // [STEP] CALC_DAYS
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // [STEP] WEIGHT_SCORE
    // (簡單範例: 天數越少分數越高，max 10, min 0.1)
    const daysFactor = Math.max(0.1, Math.min(10, 10 / Math.max(1, diffDays)));
    const rawScore = (importance * 0.6) + (daysFactor * 0.4);

    // [STEP] RETURN
    return rawScore;
}
