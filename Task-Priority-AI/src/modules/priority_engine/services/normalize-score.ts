// @GEMS-FUNCTION: normalizeScore
/**
 * GEMS: normalizeScore | P1 | ○○ | (score: number)→number | Story-2.1 | 標準化分數
 * GEMS-FLOW: INPUT_RAW → CLAMP → ROUND → RETURN
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: normalize-score.test.ts
 */
export function normalizeScore(score: number): number {
    // [STEP] INPUT_RAW
    let mapped = score * 10; // score 範圍大約在 0~10，放大到 0~100

    // [STEP] CLAMP
    if (mapped > 100) mapped = 100;
    if (mapped < 0) mapped = 0;

    // [STEP] ROUND
    const finalScore = Math.round(mapped);

    // [STEP] RETURN
    return finalScore;
}
