// ─────────────────────────────────────────────────────────────────────────────
// tdd-golden.ts — TDD 契約黃金樣板（v4.0，取代舊 AC 機制）
// ─────────────────────────────────────────────────────────────────────────────
//
// 用途：
//   這是 contract_iter-N.ts 中 @GEMS-TDD 標籤的填寫範例。
//   AI 在寫 contract.ts 時，參考此樣板決定是否需要測試檔。
//
// TDD 核心原則：
//   1. 測試腳本在 CONTRACT 階段就要寫好（先測試後實作）
//   2. Phase 1 建骨架時測試是 failing 狀態（RED）
//   3. Phase 2 跑測試，AI 修實作讓測試過（GREEN）
//   4. 不能動測試檔（測試是規格，不是實作）
//
// @GEMS-TDD 標籤規則：
//   有 @GEMS-TDD → Phase 2 跑 vitest --run
//   沒有 @GEMS-TDD（DB/UI 層）→ Phase 2 只做 tsc --noEmit
//
// ─────────────────────────────────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════════════════════
// 有測試的 Story（純計算 / 業務邏輯）
// ═══════════════════════════════════════════════════════════════════════════════

// @GEMS-STORY: Story-1.1 | TrainingPlan | 計算節點日期 | CALC
// @GEMS-TDD: src/modules/TrainingPlan/lib/__tests__/calc-node-date.test.ts

// 測試檔內容（contract 階段就要寫好）：
//
// import { describe, it, expect } from 'vitest';
// import { calcNodeDate } from '../calc-node-date';
//
// describe('calcNodeDate', () => {
//   it('從開始日期加天數計算節點日期', () => {
//     expect(calcNodeDate('2026-01-01', 7)).toBe('2026-01-08');
//   });
//   it('跨月計算', () => {
//     expect(calcNodeDate('2026-01-28', 5)).toBe('2026-02-02');
//   });
//   it('天數為 0 回傳原日期', () => {
//     expect(calcNodeDate('2026-03-15', 0)).toBe('2026-03-15');
//   });
// });


// ═══════════════════════════════════════════════════════════════════════════════
// 無測試的 Story（DB/UI/外部依賴）→ 只做 tsc --noEmit
// ═══════════════════════════════════════════════════════════════════════════════

// @GEMS-STORY: Story-1.0 | Foundation | 資料庫初始化 | Foundation
// （無 @GEMS-TDD — DB 層，Phase 2 只跑 tsc --noEmit）

// @GEMS-STORY: Story-1.3 | ClassManagement | 班級 CRUD | CRUD
// （無 @GEMS-TDD — DB CRUD，Phase 2 只跑 tsc --noEmit）


// ═══════════════════════════════════════════════════════════════════════════════
// 多個測試檔（一個 Story 有多個模組需要測試）
// ═══════════════════════════════════════════════════════════════════════════════

// @GEMS-STORY: Story-2.0 | Dashboard | 衝突偵測 + 即將到來節點 | CALC
// @GEMS-TDD: src/modules/Dashboard/lib/__tests__/detect-conflicts.test.ts
// @GEMS-TDD: src/modules/Dashboard/lib/__tests__/get-upcoming-nodes.test.ts


// ─────────────────────────────────────────────────────────────────────────────
// 決策樹：要不要加 @GEMS-TDD？
//
//   這個 Story 有純計算邏輯或業務規則？
//     ├─ 是 → 加 @GEMS-TDD，在 contract 階段就寫好測試檔
//     └─ 否（DB CRUD / UI / 外部 API）→ 不加，Phase 2 只跑 tsc --noEmit
//
// 測試檔路徑慣例：
//   src/modules/{Module}/lib/__tests__/{function-name}.test.ts   ← 純計算
//   src/modules/{Module}/services/__tests__/{service}.test.ts    ← 服務層（需 mock DB）
// ─────────────────────────────────────────────────────────────────────────────
