/**
 * GEMS: computeCo2e | P1 | ✓✓ | (amount: number, factor: number)→number | Story-1.0 | CO2e 計算
 * GEMS-FLOW: VALIDATE→CALC→RETURN
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: jest-unit
 * GEMS-TEST-FILE: compute-co2e.test.ts
 */
// AC-1.0
// [STEP] VALIDATE
export function computeCo2e(amount: number, factor: number): number {
  if (amount < 0) throw new Error('amount must be >= 0');
  if (factor < 0) throw new Error('factor must be >= 0');
  // [STEP] CALC
  const result = amount * factor;
  // [STEP] RETURN
  return Math.round(result * 1000) / 1000;
}
