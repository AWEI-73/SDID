/**
 * GEMS: deleteLastChar | P1 | ✓✓ | (display: string)→string | Story-1.1 | 刪除最後一個字元
 * GEMS-FLOW: UI → display
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: delete-last-char.test.ts
 */
// [STEP] UI
// [STEP] display

export function deleteLastChar(display: string): string {
  if (display.length <= 1) return '0';
  return display.slice(0, -1);
}
