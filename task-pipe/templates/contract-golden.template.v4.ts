/**
 * @GEMS-CONTRACT-VERSION: 4.0
 * @GEMS-ITER: iter-{N}
 * @GEMS-PROJECT: {ProjectName}
 * @GEMS-ROUTE: Blueprint | TaskPipe
 *
 * Contract v4 — TDD-first 可執行契約
 *
 * 此檔案是 BUILD 的唯一輸入（搭配 implementation_plan）。
 * BUILD 只讀 contract_iter-{N}.ts，不讀 draft、不讀 blueprint。
 *
 * v4 核心原則：
 *   - contract = 型別定義 + 測試檔路徑（@TEST 指向真實存在的 RED 測試）
 *   - @TEST 路徑必須在 contract-gate 前已存在（RED 狀態）
 *   - Behavior: 每行對應一個測試案例，是可否定的行為規格
 *   - GEMS-FLOW = method 層級 state machine（非內部實作步驟）
 *   - 語意層（CYNEFIN/FLOW review）已移除，由測試承擔語意驗證
 *
 * CONTRACT-GATE 驗證規則:
 *   CG-001: @CONTRACT P0 必有 @TEST
 *   CG-002: @TEST 路徑必須以 .test.ts 或 .spec.ts 結尾
 *   CG-003: @TEST 路徑必須實際存在（RED 測試已寫）
 *   CG-004: P0 Behavior: 至少有一條錯誤路徑（含 Error/拋出）
 *
 * CONTEXT_SCOPE:
 *   BUILD_READ: contract_iter-{N}.ts, implementation_plan_Story-{X}.{Y}.md
 *   BUILD_SKIP: draft_iter-{N}.md, contract_iter-{其他}.ts, blueprint.md
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 本檔案包含三個完整範例：
 *   [SIMPLE]  calcNodeDate  — 純計算函式，無副作用，測試最直接
 *   [COMPLEX] ClassService  — DB 操作服務，有 validation/error/side-effect
 *   [HOOK]    useCategories — 前端 hook，API fetch + state，component 不進 contract
 * ─────────────────────────────────────────────────────────────────────────────
 */

// @CONTRACT-LOCK: {YYYY-MM-DD} | Gate: iter-{N}
// @SPEC-CHANGES: (none)
//
// ─── 以下契約已通過 Gate，修改需加 [SPEC-FIX] 標記 ──────────────────────────

// ─── Enums ───────────────────────────────────────────────────────────────────

// @GEMS-ENUM: ScheduleStatus
// 說明：替換成你的 enum，值必須窮舉
export type ScheduleStatus = 'pending' | 'scheduled' | 'adjusted';

// ─── Entities（後端邊界，對應 DB）────────────────────────────────────────────

// @GEMS-CONTRACT: TrainingClass
// @GEMS-TABLE: tbl_training_classes
// 說明：每個欄位後面的 comment 是 DB schema，plan-generator 用來推導 CREATE TABLE
export interface TrainingClass {
  id: number;                          // INTEGER, PK, autoincrement
  className: string;                   // VARCHAR(200), NOT NULL
  startDate: string;                   // DATE, NOT NULL (ISO8601)
  endDate: string;                     // DATE, NOT NULL (ISO8601)
  scheduleStatus: ScheduleStatus;      // ENUM('pending','scheduled','adjusted'), DEFAULT 'pending'
  headcount: number;                   // INTEGER, NOT NULL
  organizer: string;                   // VARCHAR(100), NOT NULL
  notes: string | null;                // TEXT, nullable
  createdAt: string;                   // DATETIME, NOT NULL
  updatedAt: string;                   // DATETIME, NOT NULL
}

// ─── 前端 Hook 型別（前端 contract 的錨點是 hook，不是 View）────────────────
//
// 說明：
//   @GEMS-VIEW 已移除 — View 型別在實際程式碼裡沒有人 import，是裝飾性的
//   前端 contract 的連結點是 hook（fetch + state），component 只是 render 層不進 contract
//   hook 的回傳型別定義在這裡，作為 @TEST 的型別錨點

// @GEMS-HOOK: UseTrainingClassesReturn
// 說明：hook 的回傳型別，對應 @CONTRACT: useTrainingClasses 的 declare function
export interface UseTrainingClassesReturn {
  classes: TrainingClass[];
  loading: boolean;
  error: string | null;
  createClass(data: CreateClassInput): Promise<void>;
  updateClass(id: number, data: UpdateClassInput): Promise<void>;
  deleteClass(id: number): Promise<void>;
  refresh(): Promise<void>;
}

// ─── DTO ─────────────────────────────────────────────────────────────────────

export type CreateClassInput = Omit<TrainingClass, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateClassInput = Partial<Omit<TrainingClass, 'id' | 'createdAt' | 'updatedAt'>>;

// ─────────────────────────────────────────────────────────────────────────────
// [SIMPLE 範例] calcNodeDate — 純計算函式
// 特徵：無副作用、無 DB、無外部依賴，測試最直接
// ─────────────────────────────────────────────────────────────────────────────

// @GEMS-STORY: Story-{N}.1 | NodeManagement | 節點日期計算 | CALC

// @CONTRACT: calcNodeDate | P0 | LIB | Story-{N}.1
// @TEST: src/modules/NodeManagement/lib/__tests__/calc-node-date.test.ts
// @RISK: P0 — 日期計算錯誤會導致所有節點到期日偏移
// @GEMS-FLOW: PARSE_DATE(Clear)→ADD_OFFSET(Clear)→FORMAT_ISO(Clear)
//
// Behavior:
// - calcNodeDate("2026-04-01", 7)  → "2026-04-08"
// - calcNodeDate("2026-04-01", -14) → "2026-03-18"
// - calcNodeDate("2026-04-01", 0)  → "2026-04-01"
// - calcNodeDate("invalid-date", 0) → throw Error("InvalidDate")
export declare function calcNodeDate(startDate: string, offsetDays: number): string;

// ─────────────────────────────────────────────────────────────────────────────
// [COMPLEX 範例] IClassService — DB 操作服務
// 特徵：有 validation、有 DB 副作用、有 error handling、有多個 method
// 注意：複雜服務的每個 method 都要有獨立的 Behavior: 規格
// ─────────────────────────────────────────────────────────────────────────────

// @GEMS-STORY: Story-{N}.0 | ClassManagement | 班別 CRUD 後端服務 | BACKEND

// @CONTRACT: IClassService | P0 | SVC | Story-{N}.0
// @TEST: src/modules/ClassManagement/services/__tests__/class-service.test.ts
// @RISK: P0 — 班別資料核心，錯誤會影響所有下游模組（節點、儀表板）
// @GEMS-FLOW: LISTCLASSES(Clear)→CREATECLASS(Complicated)→UPDATECLASS(Complicated)→DELETECLASS(Clear)
//
// Behavior（createClass）:
// - createClass({ className: "基層主管班", startDate: "2026-04-01", ... }) → 回傳含 id 的 TrainingClass
// - createClass({ className: "", ... }) → throw Error("班別名稱為必填")
// - createClass({ className: "X", startDate: "" }) → throw Error("開始日期為必填")
// - createClass({ startDate: "2026-04-05", endDate: "2026-04-01" }) → throw Error("結束日期不得早於開始日期")
//
// Behavior（updateClass）:
// - updateClass(1, { className: "更新班別" }) → 回傳更新後的 TrainingClass
// - updateClass(9999, {}) → throw Error("找不到班別")
//
// Behavior（deleteClass）:
// - deleteClass(1) → void，不拋錯
// - deleteClass(9999) → throw Error("找不到班別")
//
// Behavior（listClasses）:
// - listClasses() → 回傳 TrainingClass[]，空陣列時回傳 []，不拋錯
// - listClasses({ scheduleStatus: "pending" }) → 只回傳 status=pending 的班別
export interface IClassService {
  listClasses(filter?: { scheduleStatus?: ScheduleStatus; organizer?: string }): TrainingClass[];
  createClass(data: CreateClassInput): TrainingClass;
  updateClass(id: number, data: UpdateClassInput): TrainingClass;
  deleteClass(id: number): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// [HOOK 範例] useTrainingClasses — 前端 hook
// 特徵：API fetch + state management，component 不進 contract
// 規則：
//   - hook 進 contract（P1），component 不進
//   - @TEST 測試 hook 的行為（loading/error/data 狀態轉換）
//   - 不測 component render，不測 mock call count
// ─────────────────────────────────────────────────────────────────────────────

// @GEMS-STORY: Story-{N}.2 | ClassManagement | 班別管理前端 hook | FRONTEND

// @CONTRACT: useTrainingClasses | P1 | HOOK | Story-{N}.2
// @TEST: src/modules/ClassManagement/hooks/__tests__/use-training-classes.test.ts
// @RISK: P1 — API 回應格式變更會讓 hook 靜默回傳空陣列，UI 無錯誤提示
// @GEMS-FLOW: INIT(Clear)→FETCH(Complicated)→REFRESH(Complicated)
//
// Behavior:
// - 初始狀態 → loading: true, classes: [], error: null
// - API 成功回應 → loading: false, classes 含完整 TrainingClass[]
// - API 失敗（網路錯誤）→ loading: false, error 非空字串, classes: []
// - createClass 成功 → 自動 refresh，classes 更新
// - deleteClass 成功 → 自動 refresh，被刪除的班別從 classes 消失
export declare function useTrainingClasses(): UseTrainingClassesReturn;

// ─────────────────────────────────────────────────────────────────────────────
// [HOOK 測試範例] use-training-classes.test.ts（RED 狀態）
//
//   import { renderHook, waitFor } from '@testing-library/react';
//   import { vi, describe, it, expect, beforeEach } from 'vitest';
//   import { useTrainingClasses } from '../use-training-classes';
//
//   // mock API client
//   vi.mock('../../../shared/api-client', () => ({
//     apiGet: vi.fn(),
//     apiPost: vi.fn(),
//   }));
//
//   import { apiGet } from '../../../shared/api-client';
//
//   describe('useTrainingClasses', () => {
//     beforeEach(() => vi.clearAllMocks());
//
//     it('初始狀態 → loading: true, classes: []', () => {
//       (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
//       const { result } = renderHook(() => useTrainingClasses());
//       expect(result.current.loading).toBe(true);
//       expect(result.current.classes).toEqual([]);
//     });
//
//     it('API 成功 → loading: false, classes 有資料', async () => {
//       const mockClasses = [{ id: 1, className: '基層主管班', startDate: '2026-04-01' }];
//       (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockClasses });
//       const { result } = renderHook(() => useTrainingClasses());
//       await waitFor(() => expect(result.current.loading).toBe(false));
//       expect(result.current.classes).toEqual(mockClasses);
//       expect(result.current.error).toBeNull();
//     });
//
//     it('API 失敗 → loading: false, error 非空', async () => {
//       (apiGet as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
//       const { result } = renderHook(() => useTrainingClasses());
//       await waitFor(() => expect(result.current.loading).toBe(false));
//       expect(typeof result.current.error).toBe('string');
//       expect(result.current.classes).toEqual([]);
//     });
//   });
//
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//
// [SIMPLE 測試範例] calc-node-date.test.ts（RED 狀態：import 的函式尚未實作）
//
//   import { describe, it, expect } from 'vitest';
//   import { calcNodeDate } from '../calc-node-date';
//
//   describe('calcNodeDate', () => {
//     it('正偏移 +7 天', () => {
//       expect(calcNodeDate('2026-04-01', 7)).toBe('2026-04-08');
//     });
//     it('負偏移 -14 天', () => {
//       expect(calcNodeDate('2026-04-01', -14)).toBe('2026-03-18');
//     });
//     it('零偏移', () => {
//       expect(calcNodeDate('2026-04-01', 0)).toBe('2026-04-01');
//     });
//     it('無效日期 → throw Error("InvalidDate")', () => {
//       expect(() => calcNodeDate('invalid-date', 0)).toThrow('InvalidDate');
//     });
//   });
//
// ─────────────────────────────────────────────────────────────────────────────
//
// [COMPLEX 測試範例] class-service.test.ts（RED 狀態）
//
//   import { describe, it, expect, beforeEach, afterEach } from 'vitest';
//   import Database from 'better-sqlite3';
//   import { initDB } from '../../../Foundation/services/init-db';
//
//   let db: Database.Database;
//   beforeEach(() => {
//     process.env.DB_PATH = ':memory:';
//     db = initDB();
//   });
//   afterEach(() => db.close());
//
//   async function getService() {
//     const { createClass, updateClass, deleteClass, listClasses } = await import('../class-service');
//     return { createClass, updateClass, deleteClass, listClasses };
//   }
//
//   describe('ClassService', () => {
//     describe('createClass', () => {
//       it('正常建立 → 回傳含 id 的 TrainingClass', async () => {
//         const { createClass } = await getService();
//         const result = createClass({
//           className: '基層主管班', startDate: '2026-04-01', endDate: '2026-04-03',
//           scheduleStatus: 'pending', headcount: 20, organizer: '人事處', notes: null,
//         });
//         expect(result.id).toBeGreaterThan(0);
//         expect(result.className).toBe('基層主管班');
//       });
//       it('缺 className → throw Error("班別名稱為必填")', async () => {
//         const { createClass } = await getService();
//         expect(() => createClass({
//           className: '', startDate: '2026-04-01', endDate: '2026-04-03',
//           scheduleStatus: 'pending', headcount: 20, organizer: '人事處', notes: null,
//         })).toThrow('班別名稱為必填');
//       });
//       it('結束日期早於開始日期 → throw Error("結束日期不得早於開始日期")', async () => {
//         const { createClass } = await getService();
//         expect(() => createClass({
//           className: '測試班', startDate: '2026-04-05', endDate: '2026-04-01',
//           scheduleStatus: 'pending', headcount: 10, organizer: '人事處', notes: null,
//         })).toThrow('結束日期不得早於開始日期');
//       });
//     });
//     describe('updateClass', () => {
//       it('id 不存在 → throw Error("找不到班別")', async () => {
//         const { updateClass } = await getService();
//         expect(() => updateClass(9999, { className: '測試' })).toThrow('找不到班別');
//       });
//     });
//     describe('deleteClass', () => {
//       it('id 不存在 → throw Error("找不到班別")', async () => {
//         const { deleteClass } = await getService();
//         expect(() => deleteClass(9999)).toThrow('找不到班別');
//       });
//     });
//     describe('listClasses', () => {
//       it('空 DB → 回傳 []', async () => {
//         const { listClasses } = await getService();
//         expect(listClasses()).toEqual([]);
//       });
//     });
//   });
//
// ─────────────────────────────────────────────────────────────────────────────
// 禁止的測試寫法（agent 必須避免）：
//
//   expect(result).toBeTruthy()          ← 太模糊，任何非 null 都過
//   expect(result).toBeDefined()         ← 無意義
//   expect(mock).toHaveBeenCalledTimes(N) ← 測 mock 不測行為
//   it('should work', () => { ... })     ← 名稱不描述行為
//
// RED 確認（contract-gate 前必須跑過）：
//   npx vitest run src/modules/NodeManagement/lib/__tests__/calc-node-date.test.ts
//   → FAIL（因 import 的函式不存在）= 正確 RED
//   → PASS = 測試太寬鬆，重寫更嚴格的 assertion
// ─────────────────────────────────────────────────────────────────────────────
