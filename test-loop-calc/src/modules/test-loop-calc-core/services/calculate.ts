/**
 * GEMS: calculate | P0 | ✓✓ | (expression: string)→Calculation | Story-1.1 | 執行計算並存入歷史
 * GEMS-FLOW: UI → SVC → storage
 * GEMS-DEPS: [Shared.MemoryStore], [Shared.Calculation]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: calculate.test.ts
 */

import { MemoryStore } from '../../../shared/storage/memory-store';
import type { Calculation } from '../../../shared/types/calculation';
import { evaluateExpression } from '../lib/evaluate-expression';

export function calculate(expression: string): Calculation {
  // [STEP] UI
  const result = evaluateExpression(expression);
  // [STEP] SVC
  const calc: Calculation = {
    id: crypto.randomUUID(),
    expression,
    result,
    createdAt: new Date().toISOString(),
  };
  // [STEP] storage
  MemoryStore.add(calc);
  return calc;
}
