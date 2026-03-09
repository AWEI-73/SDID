/**
 * GEMS: evaluateExpression | P2 | ✓✓ | (expression: string)→number | Story-1.1 | 純計算：解析數學表達式
 * GEMS-FLOW: input → calc → result
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: evaluate-expression.test.ts
 */
// AC-1.0
// AC-1.1
// AC-1.2

export function evaluateExpression(expression: string): number {
  // [STEP] input
  if (!/^[\d\s+\-*/().%]+$/.test(expression)) {
    throw new Error(`Invalid expression: ${expression}`);
  }
  // [STEP] calc
  const result = Function(`'use strict'; return (${expression})`)();
  // [STEP] result
  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error(`Invalid result for expression: ${expression}`);
  }
  return result;
}
