/**
 * GEMS: Calculation | P0 | ✓✓ | (args)→Result | Story-1.0 | 計算記錄型別定義
 * GEMS-FLOW: types → shared
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: calculation.test.ts
 */
// [STEP] types
// [STEP] shared

// @GEMS-CONTRACT: Calculation
// @GEMS-TABLE: memory (in-memory store)
export interface Calculation {
  id: string;         // UUID, PK
  expression: string; // VARCHAR(200), NOT NULL — 計算表達式，如 "2 + 3"
  result: number;     // FLOAT, NOT NULL — 計算結果
  createdAt: string;  // ISO8601, NOT NULL — 建立時間
}
