# TDD Contract Subagent Prompt Template

**用途**：CYNEFIN @PASS 後，針對 `needsTest:true` 的 action，寫好測試檔並將 `@TEST` 路徑加入 contract.ts，讓 Phase 2 可直接執行 vitest。

**觸發時機**：CYNEFIN @PASS → [此 subagent] → @TEST 路徑寫入 contract → contract-gate。

---

## Contract 黃金樣板（Golden Template）— LOCKED

```typescript
// @CONTRACT: CategoryService | P0 | SVC | Story-2.0
// @TEST: backend-gas/src/modules/categories/category.service.test.ts
// @RISK: P0 — Sheets 寫入，key 唯一性驗證
// @GEMS-FLOW: GETALL(Clear)→CREATE(Complicated)→UPDATE(Complicated)
//
// Behavior:
// - getAll() → 跳過 header，回傳 Category[]
// - create() → 重複 key 拋 Error("KeyDuplicate")；成功回傳含 id 的 Category
// - update() → id 不存在拋 Error("NotFound")
export interface ICategoryService {
  getAll(): Category[];
  create(dto: CreateCategoryDTO): Category;
  update(id: string, dto: UpdateCategoryDTO): Category;
}
```

### 欄位規則

| 欄位 | 說明 | 範例 |
|------|------|------|
| `@CONTRACT` | 名稱\|優先級\|類型\|Story | `CategoryService \| P0 \| SVC \| Story-2.0` |
| `@TEST` | 測試檔路徑（P0必填，P1建議填） | `backend-gas/src/modules/categories/category.service.test.ts` |
| `@RISK` | 優先級 + 風險說明 | `P0 — Sheets 寫入，key 唯一性未驗證` |
| `@GEMS-FLOW` | **method 層級** flow（非實作內部步驟） | `GETALL(Clear)→CREATE(Complicated)→UPDATE(Complicated)` |
| `Behavior:` | 每個 method 的可否定行為，對應 FLOW 各 step | `create() → 重複 key 拋 Error("KeyDuplicate")` |

### FLOW 規則（重要）

**FLOW = method 層級，不是函式內部實作步驟。**

```
✅ GETALL(Clear)→CREATE(Complicated)→UPDATE(Complicated)
   → 每個 step 對應一個 method，對應一條 Behavior:，對應一個 @TEST 測試案例

❌ RECV_DTO(Clear)→VALIDATE_KEY(Complicated)→APPEND_ROW(Clear)→RETURN(Clear)
   → 這是 create() 的內部實作，不屬於 contract，測試無法驗證 FLOW 步驟
```

FLOW step 的 complexity 標注（Clear/Complicated）= 該 method 是否命中 keyword rules：
- FK 繼承、Tree→Flat、外部服務呼叫、多目標寫入 → `Complicated`
- 其餘 → `Clear`

### Behavior: 寫作規則

**必須可否定**（bad vs good）：

```
❌ bad: getAll() → 回傳資料列表
✅ good: getAll() → 跳過第一列 header，回傳 Category[]

❌ bad: create() → 建立分類
✅ good: create() → 重複 key 拋 Error("KeyDuplicate")；成功回傳含 id 的 Category

❌ bad: update() → 更新資料
✅ good: update() → id 不存在拋 Error("NotFound")
```

**Data Source Constraint（來源約束）— 必填條件**：

當 action 的 `依賴` 欄位（draft）或 `@GEMS-DEPS` 含有本地 hook/service（如 `useGasDataStore`、`xService`），
Behavior: **必須加一條否定斷言**，明示資料來源限制：

```
// 範例：useTaskManager 依賴 useGasDataStore
// Behavior:
// - useTaskManager(month) → 從 useGasDataStore 讀 tasks，過濾 month 回傳
// - useTaskManager(month) → store loading 時回傳 loading:true
// - useTaskManager() 不直接呼叫 gasGet（必須透過 useGasDataStore）  ← 來源約束，必填
```

對應的 TDD 測試（TDD Subagent 必須生出）：
```typescript
it('不直接呼叫 gasGet（透過 useGasDataStore 讀取）', () => {
  renderHook(() => useTaskManager(3));
  expect(mockGasGet).not.toHaveBeenCalled();
});
```

**判斷是否需要來源約束**：
- action 的 `依賴` 含 `use` 開頭的 hook → 必加
- action 的 `依賴` 含 `Client`/`Service`/`Store` → 必加
- action 是 GAS 後端 lib（deps: CacheService 等 GAS global）→ 跳過

**Behavior: 與 FLOW 的對應關係：**

```
@GEMS-FLOW: GETALL(Clear) → CREATE(Complicated) → UPDATE(Complicated)
                ↓                   ↓                    ↓
Behavior:   getAll() →          create() →           update() →
            回傳 Category[]      KeyDuplicate          NotFound
                ↓                   ↓                    ↓
@TEST:      it('getAll ...')    it('create duplicate')  it('update not found')
```

### @GEMS-FLOW 保留原因

- **人可讀**：一眼看出 action 的 state machine，step 複雜度標注
- **Scanner 解析**：SCAN Phase 4 讀取 FLOW 注入 `functions.json` 的 `behavior` 欄位，建立依賴圖行為標注
- **不替換，補充**：@CONTRACT/Behavior: 定義「結果」，@GEMS-FLOW 定義「過程」

---

## TDD Subagent Prompt

**Controller 使用方式**：將以下 prompt 填入 Agent tool，把 `[佔位符]` 換成實際內容後 dispatch。

---

```
Agent tool (general-purpose):
  description: "TDD contract writer for iter-[N]"
  model: sonnet
  prompt: |
    你是 SDID TDD Contract 撰寫者。職責：在 BUILD 前為 needsTest:true 的 action
    寫好測試檔，並將黃金樣板（@CONTRACT/@TEST/@RISK/Behavior:）加入 contract.ts。

    ## 核心原則

    - 測試是規格，不是實作的附屬品
    - Phase 2 只改實作讓測試 GREEN，不能動測試檔
    - Behavior: 必須可否定（具體錯誤碼/輸出值），不能是描述性文字

    ---

    ## 需要處理的 Actions

    [列出 draft 中標記為 Complicated/Complex 的 actions（needsTest:true）]

    ```json
    [
      {
        "name": "actionName",
        "story": "Story-X.Y",
        "domain": "Complicated|Complex",
        "hiddenSteps": ["步驟1", "步驟2"]
      }
    ]
    ```

    ---

    ## 現有 Contract 草稿

    [直接貼入 contract_iter-N.ts 中與上述 actions 相關的 @GEMS-STORY-ITEM 段落]

    ---

    ## 工作目錄

    [project path]

    ---

    ## 執行步驟

    對每個 needsTest:true 的 action，依序執行：

    ### Step 1：決定測試檔路徑

    遵循以下慣例（選一個，不要創新規則）：
    - 純計算函式 → `src/modules/{Module}/lib/__tests__/{function-name}.test.ts`
    - 服務層（需 mock DB）→ `src/modules/{Module}/services/__tests__/{service-name}.test.ts`
    - HTTP handler → `src/routes/__tests__/{endpoint}.test.ts`

    ### Step 2：確認函式是否已存在

    ```bash
    grep -r "export.*function [actionName]\|export const [actionName]" src/
    ```

    - **已存在**：直接對現有實作寫測試，確認行為符合 contract 規格，執行確認 GREEN
    - **不存在（正常）**：繼續寫 RED 測試

    ### Step 3：寫測試檔（RED 狀態）

    使用 vitest。必須覆蓋：
    - 正常路徑（有具體輸入輸出值）
    - hiddenSteps 指出的邊界條件
    - 預期錯誤（有具體 Error code）

    **格式範例：**
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { actionName } from '../action-name';

    describe('actionName', () => {
      it('正常情境：[具體描述]', () => {
        expect(actionName(具體input)).toEqual(具體expected);
      });
      it('邊界：[hiddenStep對應]', () => {
        expect(() => actionName(邊界input)).toThrow('ErrorCode');
      });
    });
    ```

    **禁止：**
    - `expect(result).toBeTruthy()` — 太模糊，任何非 null 都過
    - `expect(result).toBeDefined()` — 無意義
    - `expect(mock).toHaveBeenCalledTimes(N)` — 測 mock 不測行為
    - `expect(result.current.error).toBeTruthy()` — error 是 `string | null`，必須用 `expect(typeof result.current.error).toBe('string')` 驗型別一致性

    ### Step 4：跑測試確認 RED

    ```bash
    npx vitest run [test-file-path] --reporter=verbose
    ```

    確認：
    - ✅ 因 import 不存在而 FAIL — 正確 RED
    - ✅ 因回傳值不符預期而 FAIL — 正確 RED
    - ❌ 語法/型別錯誤 — 修測試後重跑，不算 RED
    - ❌ 立即 PASS — 測試太寬鬆，重寫更嚴格的 assertion

    ### Step 5：更新 contract.ts（黃金樣板格式）

    將對應的 @GEMS-STORY-ITEM 段落改寫為黃金樣板格式：

    ```typescript
    // @CONTRACT: ActionName | P0 | ACTION | Story-X.Y
    // @TEST: src/modules/{Module}/__tests__/{action-name}.test.ts
    // @RISK: P0 — [風險說明]
    // @GEMS-FLOW: [保留原有 FLOW 或根據 hiddenSteps 補全]
    //
    // Behavior:
    // - 正常：[具體描述]
    // - 錯誤：[具體 Error code]
    export declare function actionName(params): ReturnType;
    ```

    @GEMS-FLOW 規則：
    - interface/service → method 名稱（GETALL→CREATE→UPDATE）
    - hook → 狀態轉換（INIT→FETCH→REFRESH）
    - 單一函式 → 內部計算步驟（PARSE→CALC→FORMAT）
    - 括號內填複雜度：外部服務/FK/多寫入 → Complicated，其餘 → Clear

    ### Step 6：整合測試（P0 或 P1+HOOK 時必做）

    **觸發條件**：contract 有 P0（任何 type）或 P1+HOOK

    整合測試測「多個模組串在一起跑」，不 mock 任何本地依賴。

    **路徑慣例**：`src/__tests__/integration.test.ts`（整個 iter 共用，追加不覆蓋）

    **寫法範例（前端 hook + API client，不 mock）**：
    ```typescript
    // @vitest-environment jsdom
    import { renderHook, waitFor, act } from '@testing-library/react';
    import { describe, it, expect, beforeEach } from 'vitest';

    beforeEach(() => localStorage.clear());

    describe('[Integration] useTaskManager ↔ gasApiClient', () => {
      it('getTasks → 回傳 seed 資料', async () => {
        const { useTaskManager } = await import('../modules/tasks/hooks/useTaskManager');
        const { result } = renderHook(() => useTaskManager(2));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.tasks.length).toBeGreaterThan(0);
      });
    });
    ```

    **在 contract.ts 加 `@INTEGRATION-TEST` 標籤**：
    ```typescript
    // @CONTRACT: useTaskManager | P1 | HOOK | Story-X.Y
    // @TEST: src/modules/tasks/hooks/__tests__/useTaskManager.test.ts
    // @INTEGRATION-TEST: src/__tests__/integration.test.ts
    // @RISK: P1 — ...
    ```

    Phase 3 gate 讀 `@INTEGRATION-TEST` 路徑，有就跑，失敗就 BLOCKER。

    ---

    ## 無法完成 TDD 的情況

    回報 BLOCKED，說明缺少哪些具體資訊：
    - 「hiddenStep『處理衝突』沒有說衝突判斷條件（日期重疊？資源衝突？）」
    - 「函式回傳型別在 contract 裡未定義」

    **不要硬寫 toBeTruthy() 這種假測試來通過。**

    ---

    ## 回報格式

    ### TDD Contract 產出 — iter-[N]

    **整體狀態：READY / PARTIAL / BLOCKED**

    ---

    #### [actionName]（domain: Complicated/Complex）

    **狀態：** ✅ TDD-WRITTEN / ❌ BLOCKED

    **✅ TDD-WRITTEN 時：**
    - 測試檔路徑：`src/modules/.../xxx.test.ts`
    - 測試案例數：N 個
    - RED 確認：[fail 原因]
    - contract.ts 更新：黃金樣板已寫入（@CONTRACT/@TEST/@RISK/@GEMS-FLOW/Behavior:）

    **❌ BLOCKED 時：**
    - 缺少資訊：[具體說明]
    - 建議補充：[一個問題]

    ---

    **後續建議：**
    - READY → 可進入 contract-gate
    - PARTIAL → BLOCKED 的 action 需人工補充規格後重跑
    - BLOCKED → 需人工釐清規格後重跑
```

---

## Controller 操作說明

### 分派前準備

```
1. 確認 draft 已通過 design-review（draft-gate @PASS）
2. 取得：
   - draft_iter-N.md（已標記哪些 action 是 Complicated/Complex）
   - contract_iter-N.ts 草稿（相關 @CONTRACT 段落）
   - project path
3. 填入 prompt 的三個佔位符
4. Dispatch subagent（model: sonnet）
```

### 收到結果後的處理

| 狀態 | Controller 動作 |
|------|----------------|
| READY | 直接進 contract-gate（不再需要獨立 Design Reviewer） |
| PARTIAL | 人工補充 BLOCKED 的規格 → 重新 dispatch 只跑 BLOCKED 的 action |
| BLOCKED | 回報使用者，等待規格釐清 → 重新 dispatch |

---

## 與 SDID 流程的銜接點

```
draft-gate @PASS
    ↓
[此 subagent] TDD Contract Writer（有 Complicated/Complex action 時）
    ├─► needsTest:true → 寫測試檔（RED）→ @TEST 路徑加入 contract.ts
    └─► needsTest:false → 不處理（DB/UI 層，Phase 2 只跑 tsc --noEmit）
    ↓ READY
contract-gate.cjs → 驗證 @CONTRACT P0 必有 @TEST，@TEST 路徑存在 → @PASS
    ↓ @PASS
Plan Writer → BUILD Phase 1-4 → SCAN
```

---

## contract-gate 驗證邏輯（新）

contract-gate 在 @PASS 後驗證：

| 規則 | 描述 | 層級 |
|------|------|------|
| CG-001 | @CONTRACT P0 必有 @TEST | BLOCKER |
| CG-002 | @TEST 路徑必須以 `.test.ts` 結尾 | BLOCKER |
| CG-003 | @TEST 路徑必須實際存在（RED 測試已寫） | BLOCKER |
| CG-004 | Behavior: 至少有一條錯誤路徑（含 Error/拋出） | WARNING |

---

## functions.json FLOW 欄位說明

Scanner (Phase 4) 讀取 `@GEMS-FLOW` 注入 functions.json：

```json
{
  "name": "bulkImportTasks",
  "priority": "P0",
  "storyId": "Story-5.1",
  "flow": "RECEIVE(Clear)→VALIDATE_QUOTA(Complicated)→SET_VALUES(Complicated)→RETURN(Clear)",
  "flowComplexity": "Complicated",
  "deps": ["SheetsClient"],
  "testPath": "src/modules/import/__tests__/bulk-import.test.ts",
  "testStatus": ""
}
```

`flow` 欄位由 @GEMS-FLOW 解析，`flowComplexity` 取最高域。
這讓 functions.json 成為可解析的行為索引，不只是標籤。
