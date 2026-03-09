/**
 * GEMS: calcCo2e | P1 | ✓✓ | (amount: number, factor: number)→number | Story-1.0 | CO2e 純計算
 * GEMS-FLOW: VALIDATE→CALC→RETURN
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: jest-unit
 * GEMS-TEST-FILE: calc-co2e.test.ts
 */
// AC-1.3
export function calcCo2e(amount: number, factor: number): number {
  // [STEP] VALIDATE
  if (amount < 0) throw new Error('amount must be >= 0');
  if (factor < 0) throw new Error('factor must be >= 0');
  // [STEP] CALC
  const raw = amount * factor;
  // [STEP] RETURN
  return Math.round(raw * 1000) / 1000;
}
