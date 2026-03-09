/**
 * GEMS: pressKey | P1 | ✓✓ | (key: string, display: string)→string | Story-1.1 | 按下數字或運算子
 * GEMS-FLOW: UI → display
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: press-key.test.ts
 */
// [STEP] UI
// [STEP] display

export function pressKey(key: string, display: string): string {
  if (display === 'Error') return key;
  return display === '0' ? key : display + key;
}
