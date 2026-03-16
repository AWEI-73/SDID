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
 *   @GEMS-AC              — 驗收條件（ac-runner 機械驗收）
 *   @GEMS-AC-SKIP         — 跳過 ac-runner
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

// @GEMS-STORIES
// Story-{N}.0 | {Story 描述} | {Story 類型: Foundation/CRUD/CALC/UI}

// ─── Story Items（v3 擴充：技術名稱 + FLOW + DEPS）────────────

// @GEMS-STORY-ITEM: Story-{N}.0
// - {業務描述} | {TYPE} | P{0-3} | {techName} | {FLOW: STEP1→STEP2→RETURN} | {DEPS: [dep1, dep2]}

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

// ─── AC 驗收條件 ─────────────────────────────────────────────
//
// AC 分三種模式（由 CYNEFIN actions[] 的 needsTest 決定驗收方式）：
//
// [CALC] 純計算函式 — needsTest:false → ac-runner 直接執行
//   適用：無 side effect、無前置狀態依賴的純邏輯函式
//   定位：骨架確認 + happy path 不爆
//
// [CALC+SETUP] 有狀態流程 — needsTest:true → ac-runner 生成 vitest test
//   適用：需前置資料，但可用 production function 本地建立
//   SETUP 步驟在 vitest beforeEach 內執行
//
// [SKIP] 無法自動驗收 — 開發者自行負責
//   適用：UI 互動、需要外部 API/DB（無法本地跑）

// [CALC] 純計算範例
// @GEMS-AC: AC-{N}.0
// @GEMS-AC-FN: {functionName}
// @GEMS-AC-MODULE: modules/{Module}/services/{file-name}
// @GEMS-AC-INPUT: [{testInput}]
// @GEMS-AC-EXPECT: {expectedOutput}

// [CALC] 回傳值含不確定欄位（如 id）
// @GEMS-AC: AC-{N}.1
// @GEMS-AC-FN: {functionName}
// @GEMS-AC-MODULE: modules/{Module}/services/{file-name}
// @GEMS-AC-INPUT: [{testInput}]
// @GEMS-AC-EXPECT: (result) => result.id && result.id.length > 0

// [CALC] 有狀態流程（透過 SETUP 建立前置資料）
// @GEMS-AC: AC-{N}.1
// @GEMS-AC-FN: {functionName}
// @GEMS-AC-MODULE: modules/{Module}/services/{file-name}
// @GEMS-AC-SETUP: [{"fn":"{setupFn}","module":"{setupModule}","args":[{setupArgs}]}]
// @GEMS-AC-INPUT: [{testInput}]
// @GEMS-AC-EXPECT: (result) => {booleanExpression}

// [SKIP] 無法自動驗收
// @GEMS-AC: AC-{N}.2
// @GEMS-AC-SKIP: {跳過原因：UI 互動 / 需要外部 API-DB 無法本地跑}
