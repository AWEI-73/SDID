# Contract 黃金樣板 — 完整參考文件

## 一、單一 block 格式（LOCKED）

```typescript
// @CONTRACT: {Name} | {P0|P1} | {SVC|ACTION|HTTP|COMPONENT} | {Story-X.Y}
// @TEST: {project}/src/modules/{Module}/__tests__/{name}.test.ts
// @RISK: {P0|P1} — {一句話：什麼操作、什麼失敗後果}
// @GEMS-FLOW: {METHOD1}({Clear|Complicated})→{METHOD2}({Clear|Complicated})→...
//
// Behavior:
// - {method1}() → {具體輸出描述}
// - {method2}() → {邊界條件} 拋 Error("{ErrorCode}")
// - {method3}() → {id 不存在} 拋 Error("{ErrorCode}")
export interface I{Name} {
  method1(): ReturnType;
  method2(dto: DTO): ReturnType;
}
```

---

## 二、真實範例（SVC）

```typescript
// @CONTRACT: CategoryService | P0 | SVC | Story-2.0
// @TEST: 工作流程管理/backend-gas/src/modules/categories/category.service.test.ts
// @RISK: P0 — Sheets 寫入，key 唯一性未驗證會導致重複分類
// @GEMS-FLOW: GETALL(Clear)→CREATE(Complicated)→UPDATE(Complicated)→DELETE(Clear)
//
// Behavior:
// - getAll() → 跳過第一列 header，回傳 Category[]；無資料回傳 []
// - create() → 重複 key 拋 Error("KeyDuplicate")；成功回傳含 id 的 Category
// - update() → id 不存在拋 Error("NotFound")；成功回傳更新後的 Category
// - delete() → id 不存在拋 Error("NotFound")；成功回傳 void
export interface ICategoryService {
  getAll(): Category[];
  create(dto: CreateCategoryDTO): Category;
  update(id: string, dto: UpdateCategoryDTO): Category;
  delete(id: string): void;
}
```

---

## 三、真實範例（ACTION — 前端操作）

```typescript
// @CONTRACT: exportDataToCSV | P1 | ACTION | Story-5.1
// @TEST: 工作流程管理/frontend/src/features/export/__tests__/export-data.test.ts
// @RISK: P1 — 樹狀資料打平邏輯錯誤會導致匯出欄位錯位
// @GEMS-FLOW: FLATTEN_TREE(Complicated)→TO_CSV(Clear)→DOWNLOAD(Clear)
//
// Behavior:
// - exportDataToCSV() → 樹狀資料打平後產生 CSV blob 並觸發下載
// - exportDataToCSV() → 畫面無資料時 button disabled，不觸發下載
// - exportDataToCSV() → FLATTEN 保留父子關係欄位（parentId 正確對應）
export declare function exportDataToCSV(): void;
```

---

## 四、真實範例（HTTP — GAS endpoint）

```typescript
// @CONTRACT: bulkImportTasks | P0 | HTTP | Story-5.1
// @TEST: 工作流程管理/backend-gas/src/routes/__tests__/bulk-import.test.ts
// @RISK: P0 — GAS Quota 超限或 JSON 解析失敗會導致部分資料寫入，無法回滾
// @GEMS-FLOW: RECEIVE(Clear)→VALIDATE_QUOTA(Complicated)→SET_VALUES(Complicated)→RETURN(Clear)
//
// Behavior:
// - bulkImportTasks() → payload 非合法 JSON 回傳 400 Error("ParseError")
// - bulkImportTasks() → tasks 超過 GAS 單次 quota 回傳 429 Error("QuotaExceeded")
// - bulkImportTasks() → 成功一次 setValues 寫入，回傳 { ok: true, count: N }
export declare function bulkImportTasks(payload: ImportExportPayload): Record<string, unknown>;
```

---

## 五、欄位規則

### @CONTRACT

```
{Name} | {Priority} | {Type} | {StoryId}
```

| 欄位 | 規則 |
|------|------|
| Name | 對應 interface/function 名稱，首字大寫 |
| Priority | `P0`（核心路徑）或 `P1`（輔助功能） |
| Type | `SVC`（服務層）、`ACTION`（前端操作）、`HTTP`（API endpoint）、`COMPONENT`（UI 元件） |
| StoryId | 對應 draft 中的 `@GEMS-STORY` id |

### @TEST

- P0 必填，P1 建議填
- 路徑從 project root 開始（含 project 資料夾名）
- 必須以 `.test.ts` 或 `.spec.ts` 結尾
- contract-gate 會驗證此路徑實際存在（RED 狀態測試已寫入）

### @RISK

- 格式：`{P0|P1} — {操作描述}，{失敗後果}`
- 必須說明「什麼出錯」和「什麼後果」，不能只寫功能名稱

### @GEMS-FLOW

**method 層級，不是函式內部實作步驟。**

```
✅ GETALL(Clear)→CREATE(Complicated)→UPDATE(Complicated)
   每個 step = 一個 interface method = 一條 Behavior: = 至少一個 @TEST 測試案例

❌ RECV_DTO(Clear)→VALIDATE_KEY(Complicated)→APPEND_ROW(Clear)
   這是 create() 的內部實作，不屬於 contract 層
```

**Complexity 標注規則：**

| 標 Complicated | 條件 |
|---------------|------|
| FK 繼承 | output 需包含上層物件 id |
| Tree→Flat 映射 | 巢狀結構打平 |
| 外部服務呼叫 | GAS / Firebase / Stripe 等 |
| 多目標寫入 | 同時寫 2+ Sheet/Table |
| 整合邊界切換 | IS_MOCK / USE_REAL_API 分支 |

其餘標 `Clear`。

### Behavior:

**必須可否定** — 測試能根據這行直接寫 assertion。

```
❌ getAll() → 回傳資料             （描述性，無法驗證）
✅ getAll() → 跳過 header，回傳 Category[]  （可驗：length、第一筆不是 header）

❌ create() → 建立分類             （描述性）
✅ create() → 重複 key 拋 Error("KeyDuplicate")  （可驗：toThrow("KeyDuplicate")）
```

**每個 FLOW step 必須有對應的 Behavior: 行：**

```
@GEMS-FLOW: GETALL(Clear) → CREATE(Complicated) → UPDATE(Complicated)
                ↓                  ↓                     ↓
Behavior:   getAll() →         create() →            update() →
            回傳 Category[]    KeyDuplicate 或成功     NotFound 或成功
                ↓                  ↓                     ↓
@TEST:      it('getAll...')    it('create dup...')   it('update not found...')
```

---

## 六、完整 contract 檔案結構

```typescript
// @CONTRACT-LOCK: {date} | Gate: iter-N
// @SPEC-CHANGES: (none) | 或列出變更
//
// ─── 以下契約已通過 Gate，修改需加 [SPEC-FIX] 標記 ──────────────────────────
/**
 * @GEMS-CONTRACT iter-N
 */

// ── Story-X.0 ────────────────────────────────────────────────────────────────
// @GEMS-STORY: Story-X.0 | {StoryName} | {中文說明} | {FRONTEND|BACKEND|BACKEND_FRONTEND}

// @CONTRACT: {Name} | P0 | {Type} | Story-X.0
// @TEST: {path}.test.ts
// @RISK: P0 — {說明}
// @GEMS-FLOW: METHOD1(Clear)→METHOD2(Complicated)
//
// Behavior:
// - method1() → {具體結果}
// - method2() → {ErrorCode} 或成功描述
export interface I{Name} { ... }

// @CONTRACT: {Name2} | P1 | {Type} | Story-X.0
// @TEST: {path}.test.ts    ← P1 建議填
// @RISK: P1 — {說明}
// @GEMS-FLOW: ACTION1(Clear)→ACTION2(Clear)
//
// Behavior:
// - action1() → {具體結果}
export declare function name2(): void;

// ── Story-X.1 ────────────────────────────────────────────────────────────────
// @GEMS-STORY: Story-X.1 | ...
// ...
```

---

## 七、GEMS 行內標籤（程式碼端）

contract.ts 定義規格，實作檔用簡化 1 行標籤連結：

```typescript
/** GEMS: CategoryService | P0 | Story-2.0 | GETALL(Clear)→CREATE(Complicated)→UPDATE(Complicated) | deps:[SheetsClient,CoreTypes] */
export class CategoryService implements ICategoryService {
  // ...
}
```

格式：`/** GEMS: {Name} | {P0|P1} | {StoryId} | {FLOW} | deps:[{dep1,dep2}] */`

Scanner 讀此行注入 functions.json：
- `name`, `priority`, `storyId` → 基本索引
- `flow` → behavior 解析（flowComplexity 取最高域）
- `deps` → 依賴圖

---

## 八、contract-gate 驗證項目

| 規則 | 描述 | 層級 |
|------|------|------|
| CG-001 | @CONTRACT P0 必有 @TEST | BLOCKER |
| CG-002 | @TEST 路徑必須以 `.test.ts` 或 `.spec.ts` 結尾 | BLOCKER |
| CG-003 | @TEST 路徑必須實際存在（RED 測試已寫） | BLOCKER |
| CG-005 | Behavior: 至少有一條含 Error/拋出 的錯誤路徑（P0） | WARNING |
| CG-006 | FLOW step 數 = Behavior: 行數（對應關係完整） | WARNING |
