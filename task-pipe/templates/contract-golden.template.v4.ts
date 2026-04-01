/**
 * @GEMS-CONTRACT-VERSION: 4.0
 * @GEMS-ITER: iter-{N}
 * @GEMS-PROJECT: {ProjectName}
 * @GEMS-ROUTE: Blueprint | TaskPipe
 *
 * Contract v4 — HARNESS 格式（TDD-first）
 *
 * 此檔案是 BUILD 的唯一輸入（搭配 implementation_plan）。
 * BUILD 只讀 contract_iter-{N}.ts，不讀 draft、不讀 blueprint。
 *
 * v4 變更（相對 v3）:
 *   - @CONTRACT/@TEST/@RISK/@GEMS-FLOW/Behavior: 取代 STORY-ITEM/GEMS-WHY
 *   - @TEST 必須有真實測試檔（RED 狀態），contract-gate 驗路徑存在
 *   - @GEMS-FLOW = method 層級（非內部實作步驟）
 *   - Behavior: = 可否定的行為規格，對應 @TEST 測試案例
 *   - @GEMS-WHY 移除（語意層，改由 Behavior: 承擔）
 *   - BUILD_REF 移除（agent 不會讀 blueprint，指引虛化）
 *
 * 標籤清單:
 *   @CONTRACT        — 函式/服務規格 header（Name|Priority|Type|StoryId）
 *   @TEST            — 測試檔路徑（P0 必填，P1 建議填）
 *   @RISK            — 失敗風險說明
 *   @GEMS-FLOW       — method 層級 state machine（每 step = 一個 method）
 *   Behavior:        — 可否定的行為規格（每行對應一個測試案例）
 *   @GEMS-CONTRACT   — Entity 定義（後端邊界，對應 DB）
 *   @GEMS-TABLE      — DB 表對應
 *   @GEMS-VIEW       — 前端 View 型別（後端欄位的子集）
 *   @GEMS-ENUM       — 列舉型別
 *
 * CONTRACT-GATE 驗證規則:
 *   CG-001: @CONTRACT P0 必有 @TEST
 *   CG-002: @TEST 路徑必須以 .test.ts 或 .spec.ts 結尾
 *   CG-003: @TEST 路徑必須實際存在（RED 測試已寫）
 *   CG-004: cynefin-report needsTest:true 的 action 必有 @TEST
 *   CG-005: P0 Behavior: 至少有一條錯誤路徑（含 Error/拋出）
 *   CG-006: FLOW step 數 = Behavior: 行數（對應關係完整）
 *
 * CONTEXT_SCOPE:
 *   BUILD_READ: contract_iter-{N}.ts, implementation_plan_Story-{X}.{Y}.md
 *   BUILD_SKIP: draft_iter-{N}.md, contract_iter-{其他}.ts, blueprint.md
 */

// @CONTRACT-LOCK: {YYYY-MM-DD} | Gate: iter-{N}
// @SPEC-CHANGES: (none)
//
// ─── 以下契約已通過 Gate，修改需加 [SPEC-FIX] 標記 ──────────────────────────

// ─── Enums ───────────────────────────────────────────────────────────────────

// @GEMS-ENUM: {EnumName}
export type {EnumName} = '{VALUE1}' | '{VALUE2}' | '{VALUE3}';

// ─── Entities（後端邊界，對應 DB）────────────────────────────────────────────

// @GEMS-CONTRACT: {EntityName}
// @GEMS-TABLE: tbl_{table_name}
export interface {EntityName} {
  id: string;           // UUID, PK
  {field}: {type};      // {DB_TYPE}, {CONSTRAINT}
}

// ─── Views（前端邊界：後端欄位子集，api-only 欄位不暴露）────────────────────

// @GEMS-VIEW: {EntityName}View
// @GEMS-FIELD-COVERAGE: id=frontend, {field}=frontend, {sensitiveField}=api-only
export interface {EntityName}View {
  id: string;
  {field}: {type};
  // api-only 欄位不出現在 View
}

// ─── Story-{N}.0 ─────────────────────────────────────────────────────────────

// @GEMS-STORY: Story-{N}.0 | {ModuleName} | {中文說明} | {FRONTEND|BACKEND|BACKEND_FRONTEND}

// @CONTRACT: {ServiceName} | P0 | SVC | Story-{N}.0
// @TEST: {project}/src/modules/{Module}/__tests__/{service-name}.test.ts
// @RISK: P0 — {操作描述}，{失敗後果}
// @GEMS-FLOW: {METHOD1}(Clear)→{METHOD2}(Complicated)→{METHOD3}(Clear)
//
// Behavior:
// - {method1}() → {具體輸出，e.g. 跳過 header 回傳 Entity[]}
// - {method2}() → {邊界條件} 拋 Error("{ErrorCode}")；成功回傳含 id 的 Entity
// - {method3}() → id 不存在拋 Error("NotFound")
export interface I{ServiceName} {
  {method1}(): {ReturnType}[];
  {method2}(dto: {CreateDTO}): {ReturnType};
  {method3}(id: string, dto: {UpdateDTO}): {ReturnType};
}

// ─── Story-{N}.1 ─────────────────────────────────────────────────────────────

// @GEMS-STORY: Story-{N}.1 | {ModuleName} | {中文說明} | {FRONTEND|BACKEND}

// @CONTRACT: {ActionName} | P1 | ACTION | Story-{N}.1
// @TEST: {project}/src/features/{feature}/__tests__/{action-name}.test.ts
// @RISK: P1 — {操作描述}，{失敗後果}
// @GEMS-FLOW: {ACTION1}(Clear)→{ACTION2}(Complicated)→{ACTION3}(Clear)
//
// Behavior:
// - {action1}() → {具體輸出}
// - {action2}() → {邊界條件描述}
export declare function {actionName}(): void;

// ─── 測試檔格式參考 ───────────────────────────────────────────────────────────
//
// @TEST 指定的測試檔長這樣（RED 狀態：import 的函式尚未實作）：
//
// import { describe, it, expect } from 'vitest';
// import { {method2} } from '../{service-name}';
//
// describe('{ServiceName}', () => {
//   describe('{method2}', () => {
//     it('重複 key → 拋 Error("KeyDuplicate")', () => {
//       expect(() => {method2}({ key: 'existing-key' })).toThrow('KeyDuplicate');
//     });
//     it('成功 → 回傳含 id 的 Entity', () => {
//       const result = {method2}({ key: 'new-key', label: 'Test' });
//       expect(result).toMatchObject({ id: expect.any(String), key: 'new-key' });
//     });
//   });
//   describe('{method3}', () => {
//     it('id 不存在 → 拋 Error("NotFound")', () => {
//       expect(() => {method3}('non-existent-id', {})).toThrow('NotFound');
//     });
//   });
// });
//
// 禁止：
//   expect(result).toBeTruthy()   ← 太模糊
//   expect(result).toBeDefined()  ← 無意義
//   expect(mock).toHaveBeenCalledTimes(N)  ← 測 mock 不測行為
//
// RED 確認（contract-gate 前必須跑過）：
//   npx vitest run {test-path} --reporter=verbose
//   → FAIL（因 import 的函式不存在）= 正確 RED
//   → PASS = 測試太寬鬆，重寫更嚴格的 assertion
