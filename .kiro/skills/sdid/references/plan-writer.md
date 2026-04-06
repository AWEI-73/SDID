# Plan Writer — contract v4 → implementation plan

**用途**：contract-gate @PASS 後，讀 contract v4 + blueprint 結構圖，產出 superpowers 風格的 implementation plan。取代舊的 `spec-to-plan.cjs`。

**觸發時機**：contract-gate @PASS → [此步驟] → implementation_plan_Story-X.Y.md → BUILD Phase 1。

---

## 輸入

1. `contract_iter-N.ts`（v4 格式，含 @CONTRACT/@TEST/@GEMS-FLOW/Behavior:）
2. `blueprint.md`（路由結構圖、目錄結構）

## 輸出

`.gems/iterations/iter-N/plan/implementation_plan_Story-X.Y.md`（v4 格式）

---

## Plan 格式（LOCKED）

ALWAYS use this exact structure:

```markdown
# {iter-N} {模組名} Implementation Plan

**Goal:** {一句話目標，來自 contract @GEMS-STORY}

**Contract:** `.gems/iterations/iter-N/contract_iter-N.ts`

**Architecture:**
```
{從 blueprint 路由結構圖複製相關部分}
```

**Tech Stack:** {從 blueprint 或現有 package.json 推斷}

---

### Task 1: {@CONTRACT 名稱}

**Files:**
- Create: `{@TEST 路徑}`
- Create: `{實作檔路徑，從 blueprint 結構圖取}`

- [ ] **Step 1: 寫測試（RED）**

`{@TEST 路徑}`:
```typescript
{完整測試程式碼，每個 Behavior: 行 = 一個 it()}
```

- [ ] **Step 2: 跑確認 RED**
```bash
npx vitest run {@TEST 路徑}
# Expected: FAIL（實作不存在）
```

- [ ] **Step 3: 寫實作**

`{實作檔路徑}`:
```typescript
/** GEMS: {Name} | {P0|P1} | {StoryId} | {FLOW} | deps:[{deps}] */
{完整實作程式碼，含 [STEP] 標記對應 @GEMS-FLOW}
```

- [ ] **Step 4: 跑確認 GREEN**
```bash
npx vitest run {@TEST 路徑}
# Expected: PASS
```

- [ ] **Step 5: Commit**
```bash
git commit -m "feat({module}): {name} + tests GREEN"
```

- [ ] **Step 6: 整合測試（P0 或 P1+HOOK 時必做）**

`src/__tests__/integration.test.ts`（追加，不覆蓋）:
```typescript
// @vitest-environment jsdom
// 不 mock 任何本地依賴，測真實路徑
describe('[Integration] {ContractName} ↔ {依賴層}', () => {
  it('{正常路徑描述}', async () => { ... });
  it('{CRUD 操作後狀態正確}', async () => { ... });
});
```

在 contract.ts 加 `@INTEGRATION-TEST` 標籤：
```typescript
// @INTEGRATION-TEST: src/__tests__/integration.test.ts
```
```

---

## 轉換規則

| contract 欄位 | plan 對應 |
|--------------|----------|
| `@GEMS-STORY` | Task 標題 + Goal |
| `@CONTRACT` | Task 名稱 |
| `@TEST` | Step 1 測試檔路徑 + Step 2 指令 |
| `Behavior:` 每一行 | Step 1 裡一個 `it()` 測試案例 |
| `@GEMS-FLOW` | Step 3 實作裡的 `[STEP]` 標記 |
| `@GEMS-TABLE` 欄位 comment | Step 3 實作裡的 CREATE TABLE |
| blueprint 路由結構圖 | Architecture 區塊 + 實作檔路徑 |

---

## 範例

**輸入（contract 片段）：**

```typescript
// @CONTRACT: ICategoryService | P0 | SVC | Story-2.0
// @TEST: backend-gas/src/modules/categories/__tests__/category.service.test.ts
// @GEMS-FLOW: GETALL(Clear)→CREATE(Complicated)→REMOVE(Clear)
//
// Behavior（getAll）:
// - getAll() → 空 Sheet 回傳 []，不拋錯
//
// Behavior（create）:
// - create({ key: "project", ... }) → 成功回傳含 id 的 Category
// - create({ key: "project", ... }) when key 已存在 → throw Error 含 "Key already exists"
//
// Behavior（remove）:
// - remove("不存在的id") → throw Error 含 "Category not found"
export interface ICategoryService {
  getAll(): Category[];
  create(dto: CreateCategoryDTO): Category;
  remove(id: string): void;
}
```

**輸出（plan Task 片段）：**

```markdown
### Task 1: ICategoryService

**Files:**
- Create: `backend-gas/src/modules/categories/__tests__/category.service.test.ts`
- Create: `backend-gas/src/modules/categories/category.service.ts`

- [ ] **Step 1: 寫測試（RED）**

`backend-gas/src/modules/categories/__tests__/category.service.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryService } from '../category.service';

describe('CategoryService', () => {
  let service: CategoryService;
  beforeEach(() => { service = new CategoryService(makeMockSheet()); });

  it('getAll 空 Sheet → []', () => {
    expect(service.getAll()).toEqual([]);
  });

  it('create 成功 → 回傳含 id 的 Category', () => {
    const result = service.create({ key: 'project', label: '專案', bg: '#818cf8', fg: '#ffffff' });
    expect(result.id).toBeTruthy();
  });

  it('create key 已存在 → throw "Key already exists"', () => {
    service.create({ key: 'project', label: '專案', bg: '#818cf8', fg: '#ffffff' });
    expect(() => service.create({ key: 'project', label: '重複', bg: '#fff', fg: '#000' }))
      .toThrow('Key already exists');
  });

  it('remove id 不存在 → throw "Category not found"', () => {
    expect(() => service.remove('non-existent')).toThrow('Category not found');
  });
});
```

- [ ] **Step 2: 跑確認 RED**
```bash
npx vitest run backend-gas/src/modules/categories/__tests__/category.service.test.ts
# Expected: FAIL（CategoryService 不存在）
```

- [ ] **Step 3: 寫實作**

`backend-gas/src/modules/categories/category.service.ts`:
```typescript
/** GEMS: CategoryService | P0 | Story-2.0 | GETALL(Clear)→CREATE(Complicated)→REMOVE(Clear) | deps:[GasSheet] */

// [STEP] GETALL — 讀取所有分類，空 Sheet 回傳 []
// [STEP] CREATE — 驗證 key 唯一性，重複拋 Error("Key already exists")
// [STEP] REMOVE — 驗證 id 存在，不存在拋 Error("Category not found")

export class CategoryService {
  // ... 實作
}
```

- [ ] **Step 4: 跑確認 GREEN**
```bash
npx vitest run backend-gas/src/modules/categories/__tests__/category.service.test.ts
```

- [ ] **Step 5: Commit**
```bash
git commit -m "feat(categories): CategoryService + tests GREEN"
```
```

---

## 禁止事項

- 不寫 Phase 門控（由 log-output cjs 負責）
- 不寫 `## 工作項目` 表格（舊格式）
- 不猜檔案路徑（必須從 blueprint 路由結構圖取）
- 不省略測試程式碼（每個 Behavior: 行必須有對應的 it()）
- 沒有 @TEST 的 @CONTRACT（DB/UI 層）→ Step 1 改為 `tsc --noEmit` 驗證，不寫 vitest 測試

---

## Plan 頂部必須加的執行提示

ALWAYS 在 plan 最頂部加這段，讓 agent 和 MCP 都能正確執行：

```markdown
> **執行方式：**
> 1. 照 Step 逐一執行（Plan 執行層）
> 2. 每個 Task 完成後跑 gate 驗證（Gate 驗證層）：
>    ```bash
>    node task-pipe/runner.cjs --phase=BUILD --step=1 --story={Story-X.Y} --target={project} --iteration={iter-N}
>    node task-pipe/runner.cjs --phase=BUILD --step=2 --story={Story-X.Y} --target={project} --iteration={iter-N}
>    ```
> 3. 參考：`.agent/skills/sdid/references/build-execution.md`
```

這段提示讓：
- agent 知道執行順序
- MCP 未來可以直接解析並自動執行
- 腳本 log-output 可以在 @PASS 時提示下一步

