/**
 * @GEMS-CONTRACT-VERSION: 3.0
 * @GEMS-ITER: iter-{N}
 * @GEMS-PROJECT: {ProjectName}
 * @GEMS-ROUTE: Blueprint
 *
 * Contract v3 — Per-iter 機器語言規格
 *
 * 此檔案是 BUILD 的唯一輸入（搭配 implementation_plan）。
 * AI 從 per-iter draft 推導寫出，contract-writer gate 驗格式。
 * BUILD 不讀 Blueprint 也不讀 Draft。
 *
 * v3 變更（相對 v2）:
 *   - Per-iter 獨立檔案（不再一個 contract 包所有 iter）
 *   - STORY-ITEM 擴充：技術名稱 + FLOW + DEPS 欄位
 *   - @CONTEXT_SCOPE 宣告：明確 BUILD 該讀什麼
 *
 * 標籤清單:
 *   @GEMS-STORIES         — Story 清單（plan-generator 直讀）
 *   @GEMS-STORY-ITEM      — 每個 Story 的動作清單（含技術名稱+FLOW+DEPS）
 *   @GEMS-CONTRACT        — Entity 定義（後端邊界）
 *   @GEMS-TABLE           — DB 表對應
 *   @GEMS-VIEW            — 前端 View 型別
 *   @GEMS-API             — 公開 API 簽名
 *   @GEMS-ENUM            — 列舉型別
 *   @GEMS-TDD             — 測試檔路徑（有此標籤 → Phase 2 跑 vitest；無則只跑 tsc）
 *
 * @CONTEXT_SCOPE:
 *   BUILD_READ: contract_iter-{N}.ts, implementation_plan_Story-{X}.{Y}.md
 *   BUILD_REF:  blueprint.md#實體定義 (唯讀，不修改)
 *   BUILD_SKIP: draft_iter-{N}.md, contract_iter-{其他}.ts
 */

// @CONTRACT-LOCK: {YYYY-MM-DD} | Gate: iter-{N}
// @SPEC-CHANGES: (none)
//
// ─── 以下契約已通過 Gate，修改需加 [SPEC-FIX] 標記 ──────────────────────────

// ─── Stories ─────────────────────────────────────────────────

// @GEMS-STORY: Story-{N}.0 | {moduleName} | {Story 描述} | {Story 類型: Foundation/CRUD/CALC/UI}
// @GEMS-STORY-ITEM: {techName} | {TYPE} | P{0-3} | {FLOW: STEP1→STEP2→RETURN} | {DEPS: [dep1]}

// ─── Enums ───────────────────────────────────────────────────

// @GEMS-ENUM: {EnumName}
// export type {EnumName} = '{VALUE1}' | '{VALUE2}' | '{VALUE3}';

// ─── Entities（後端邊界，對應 DB）────────────────────────────

// @GEMS-CONTRACT: {EntityName}
// @GEMS-TABLE: tbl_{table_name}
// @GEMS-STORY: Story-{N}.0
// export interface {EntityName} {
//   id: string;           // UUID, PK
//   {field}: {type};      // {DB_TYPE}, {CONSTRAINT}
// }

// ─── Views（前端邊界）───────────────────────────────────────

// @GEMS-VIEW: {EntityName}View
// export interface {EntityName}View {
//   {field}: {type};
// }

// ─── API 簽名（公開介面契約）─────────────────────────────────

// @GEMS-API: I{ServiceName}Service
// @GEMS-STORY: Story-{N}.0
// export interface I{ServiceName}Service {
//   {methodName}({params}): Promise<{ReturnType}>;
// }

// ─── TDD 測試檔（有純計算邏輯的 Story 才需要）────────────────
//
// 規則：
//   有 @GEMS-TDD → Phase 2 跑 vitest --run（測試必須在 contract 階段就寫好）
//   沒有 @GEMS-TDD → Phase 2 只跑 tsc --noEmit（DB/UI/外部依賴層）
//
// 測試在 contract 階段就要寫好（真正的 TDD：先測試後實作）
// Phase 1 建骨架時測試是 failing 狀態（RED）
// Phase 2 修實作讓測試過（GREEN），不能動測試檔

// 有純計算邏輯的 Story
// @GEMS-STORY: Story-{N}.1 | {Module} | {描述} | CALC
// @GEMS-TDD: src/modules/{Module}/lib/__tests__/{function-name}.test.ts

// DB/UI/外部依賴的 Story（不加 @GEMS-TDD）
// @GEMS-STORY: Story-{N}.0 | {Module} | {描述} | Foundation
// （無 @GEMS-TDD — Phase 2 只跑 tsc --noEmit）

// 參考範例: task-pipe/templates/examples/contract-golden.ts
