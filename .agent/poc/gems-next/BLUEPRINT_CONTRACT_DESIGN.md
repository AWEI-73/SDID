# Blueprint Contract 設計規格
**版本**: v1.0 | **日期**: 2026-03-05

## 核心理念

類比 Task-Pipe POC 的 Contract 流程：
- Task-Pipe: AI 寫 `xxxContract.ts` → step-4 gate 驗 → step-5 spec 讀
- Blueprint:  AI 寫 `contract_iter-N.ts` → contract-writer gate 驗 → draft-to-plan 讀

**擴展→收斂模式**:
1. 擴展：loop 輸出 @TASK，AI 從 draft 自由推導所有實體邊界，寫 contract_iter-N.ts
2. 收斂：blueprint-contract-writer.cjs 驗格式，存 contract-pass-*.log
3. 整合：draft-to-plan 讀 contract，鎖定型別切割 implementation plan

---

## contract_iter-N.ts 格式規範

### 完整範例（參考 EcoTrack）

```typescript
/**
 * @GEMS-CONTRACT-VERSION: 1.0
 * @GEMS-ITER: iter-1
 * @GEMS-PROJECT: EcoTrack
 * @GEMS-ROUTE: Blueprint
 *
 * Blueprint Contract — 介面邊界鎖定
 * 由 AI 從 enhanced-draft 推導，blueprint-contract-writer 驗證後存 log
 * draft-to-plan 讀此檔案注入型別到 implementation_plan
 *
 * 擴展標籤（AI 自由填寫）:
 *   @GEMS-CONTRACT      — Entity 定義（後端邊界）
 *   @GEMS-TABLE         — DB 表對應
 *   @GEMS-VIEW          — 前端 View 型別（可與 Entity 不同）
 *   @GEMS-API           — 公開 API 簽名
 *   @GEMS-FIELD-COVERAGE — 欄位前後端分工
 *   @GEMS-ENUM          — 列舉型別
 *
 * 收斂規則（contract-writer gate 驗證）:
 *   - 每個 @GEMS-CONTRACT 必須有 @GEMS-TABLE
 *   - 每個欄位必須有 DB 型別註解
 *   - 禁止 any / unknown
 *   - 必須有 id 欄位（UUID, PK）
 *   - @GEMS-API 必須有回傳型別
 */

// ─── Stories（contract 內建 Story 清單，plan-generator 直讀） ──

// @GEMS-STORIES
// Story-0.0 | 專案骨架 + 核心型別 | Foundation
// Story-1.0 | 組織管理 CRUD | CRUD
// Story-2.0 | 碳排資料登錄 | CRUD + CALC
// Story-3.0 | 儀表板統計 | READ + CALC

// ─── Story Items（每個 Story 的動作清單） ─────────────────────

// @GEMS-STORY-ITEM: Story-0.0
// - 建立專案骨架與目錄結構 | CREATE | P0
// - 定義核心型別 (Organization, EmissionRecord) | CREATE | P0
// - 設定路由框架 | CREATE | P1

// @GEMS-STORY-ITEM: Story-1.0
// - 組織列表頁面 | CREATE | P1
// - 新增組織功能 | CREATE | P1
// - 編輯組織功能 | MODIFY | P1

// @GEMS-STORY-ITEM: Story-2.0
// - 碳排資料輸入表單 | CREATE | P1
// - 排放係數查詢 | READ | P1
// - CO2e 自動計算 | CALC | P0

// @GEMS-STORY-ITEM: Story-3.0
// - Scope 分類統計 | READ + CALC | P1
// - 月趨勢圖表 | READ | P2

// ─── Enums ───────────────────────────────────────────────────

// @GEMS-ENUM: EmissionScope
export type EmissionScope = 'SCOPE1' | 'SCOPE2' | 'SCOPE3';

// @GEMS-ENUM: RecordStatus
export type RecordStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

// ─── Entities（後端邊界，對應 DB） ────────────────────────────

// @GEMS-CONTRACT: Organization
// @GEMS-TABLE: tbl_organizations
// @GEMS-STORY: Story-1.0
export interface Organization {
  id: string;           // UUID, PK
  name: string;         // VARCHAR(200), NOT NULL
  industry: string;     // VARCHAR(100), NOT NULL
  reportYear: number;   // INT, NOT NULL
  createdAt: Date;      // TIMESTAMP, NOT NULL
}

// @GEMS-CONTRACT: EmissionRecord
// @GEMS-TABLE: tbl_emission_records
// @GEMS-STORY: Story-2.0
export interface EmissionRecord {
  id: string;           // UUID, PK
  orgId: string;        // UUID, FK → tbl_organizations.id
  scope: EmissionScope; // ENUM('SCOPE1','SCOPE2','SCOPE3'), NOT NULL
  category: string;     // VARCHAR(100), NOT NULL
  amount: number;       // DECIMAL(12,4), NOT NULL, >= 0
  unit: string;         // VARCHAR(20), NOT NULL
  factorId: string;     // UUID, FK → tbl_emission_factors.id
  co2e: number;         // DECIMAL(12,4), COMPUTED
  period: string;       // VARCHAR(7), NOT NULL (YYYY-MM)
  status: RecordStatus; // ENUM('DRAFT','SUBMITTED','APPROVED'), DEFAULT 'DRAFT'
}

// ─── Views（前端邊界，可與 Entity 不同） ──────────────────────

// @GEMS-VIEW: OrganizationView
// @GEMS-FIELD-COVERAGE: id=frontend, name=frontend, industry=frontend, reportYear=frontend, createdAt=api-only
export interface OrganizationView {
  id: string;
  name: string;
  industry: string;
  reportYear: number;
  // createdAt 不顯示在前端
}

// @GEMS-VIEW: EmissionRecordView
// @GEMS-FIELD-COVERAGE: id=frontend, scope=frontend, category=frontend, amount=frontend, unit=frontend, co2e=frontend, period=frontend, factorId=api-only, orgId=api-only, status=frontend
export interface EmissionRecordView {
  id: string;
  scope: EmissionScope;
  category: string;
  amount: number;
  unit: string;
  co2e: number;
  period: string;
  status: RecordStatus;
  // factorId, orgId 不顯示在前端
}

// ─── API 簽名（公開介面契約） ─────────────────────────────────

// @GEMS-API: IDataEntryService
// @GEMS-STORY: Story-2.0
export interface IDataEntryService {
  createRecord(data: Omit<EmissionRecord, 'id' | 'co2e'>): Promise<EmissionRecord>;
  getRecords(orgId: string, period: string): Promise<EmissionRecord[]>;
  calcEmission(amount: number, factorId: string): number;
}

// @GEMS-API: IDashboardService
// @GEMS-STORY: Story-3.0
export interface IDashboardService {
  getScopeSummary(orgId: string, year: number): Promise<Record<EmissionScope, number>>;
  getTrendData(orgId: string, months: number): Promise<Array<{ month: string; totalCo2e: number }>>;
}
```

---

## 標籤語意

| 標籤 | 用途 | 必填 | Gate 規則 |
|------|------|------|-----------|
| `@GEMS-STORIES` | Story 清單（plan-generator 直讀） | ✅ | 至少一個 Story，格式 Story-N.N |
| `@GEMS-STORY-ITEM: Story-X.Y` | Story 動作清單 | ✅ | 每個 Story 必須有對應 ITEM 區塊 |
| `@GEMS-CONTRACT: Name` | Entity 定義（後端邊界） | ✅ | 必須有對應 @GEMS-TABLE |
| `@GEMS-TABLE: tbl_xxx` | DB 表名 | ✅ | 必須在 @GEMS-CONTRACT 下方 |
| `@GEMS-STORY: Story-X.Y` | 對應哪個 Story | ✅ | 格式 Story-N.N |
| `@GEMS-VIEW: Name` | 前端 View 型別 | 建議 | 有 @GEMS-CONTRACT 時建議配對 |
| `@GEMS-FIELD-COVERAGE: ...` | 欄位前後端分工 | 建議 | 格式 field=frontend\|api-only |
| `@GEMS-API: IXxxService` | 公開 API 介面 | ✅ | 必須有回傳型別，禁止 any |
| `@GEMS-ENUM: Name` | 列舉型別 | 視需要 | 無 |

---

## blueprint-contract-writer.cjs Gate 驗證規則

### BLOCKER（阻擋）
- `CONTRACT-001`: 沒有任何 `@GEMS-CONTRACT` 標籤
- `CONTRACT-002`: `@GEMS-CONTRACT` 缺少對應 `@GEMS-TABLE`
- `CONTRACT-003`: Entity 欄位缺少 DB 型別註解（// VARCHAR/UUID/INT/DECIMAL/ENUM/TIMESTAMP）
- `CONTRACT-004`: Entity 缺少 `id` 欄位
- `CONTRACT-005`: 使用了 `any` 或 `unknown` 型別
- `CONTRACT-006`: `@GEMS-API` 方法缺少回傳型別
- `CONTRACT-007`: `@GEMS-CONTRACT` 缺少 `@GEMS-STORY` 對應

### WARN（不阻擋）
- `CONTRACT-W01`: 有 @GEMS-CONTRACT 但沒有對應 @GEMS-VIEW（前後端型別可能混用）
- `CONTRACT-W02`: 有 @GEMS-CONTRACT 但沒有 @GEMS-FIELD-COVERAGE（欄位分工不明確）
- `CONTRACT-W03`: @GEMS-API 沒有對應 @GEMS-STORY

---

## draft-to-plan 整合：contract 注入型別

### 現在（無 contract）
```javascript
// draft-to-plan 從 action.semantic 猜型別
// "核心型別定義" → 生成 CoreTypes() { return true; }  ← 匯差
```

### 加入後（有 contract）
```javascript
// draft-to-plan 讀 contract_iter-N.ts
// 找到 @GEMS-CONTRACT: Organization @GEMS-STORY: Story-1.0
// → 骨架直接注入正確型別：
// export interface Organization { id: string; name: string; ... }
// export function CoreTypes(): { Organization: typeof Organization } { ... }
```

### 具體改動：`generateScaffold()` 加 contract 注入

```javascript
function resolveContractForAction(contractTypes, actionName, storyId) {
  if (!contractTypes) return null;
  // 找 @GEMS-CONTRACT 對應此 Story 的 Entity
  return contractTypes.entities.filter(e => e.story === storyId);
}

// 骨架生成時，如果有 contract entity，直接展開欄位
if (contractEntities.length > 0) {
  lines.push(`// @GEMS-CONTRACT-REF: contract_iter-${iterNum}.ts`);
  for (const entity of contractEntities) {
    lines.push(`export interface ${entity.name} {`);
    for (const field of entity.fields) {
      lines.push(`  ${field.name}: ${field.tsType}; // ${field.dbType}`);
    }
    lines.push('}');
  }
}
```

---

## loop.mjs CONTRACT case 輸出的 @TASK

```
@TASK
ACTION: 讀 draft，推導所有實體邊界，寫 contract_iter-N.ts
FILE: {project}/.gems/iterations/iter-N/poc/contract_iter-N.ts

推導規則:
1. 從「實體定義」區塊提取所有 Entity → @GEMS-CONTRACT + @GEMS-TABLE
2. 每個欄位加 DB 型別註解（VARCHAR/UUID/INT/DECIMAL/ENUM/TIMESTAMP）
3. 為每個 Entity 建立對應的 View（前端不需要的欄位標 api-only）
4. 從「模組動作清單」的 API 欄位提取 → @GEMS-API interface
5. 每個 @GEMS-CONTRACT/@GEMS-API 標註對應的 @GEMS-STORY

格式參考: .agent/poc/gems-next/BLUEPRINT_CONTRACT_DESIGN.md

@EXPECTED: 寫完後執行:
node sdid-tools/blueprint-contract-writer.cjs --contract={path} --target={project} --iter=N
```

---

## 狀態機整合

### state-machine.cjs inferStateFromLogs 新增

```javascript
if (has('gate-check-pass-')) {
  if (!has('cynefin-check-pass-')) return { phase: 'CYNEFIN_CHECK' };
  if (!has('contract-pass-'))     return { phase: 'CONTRACT' };   // ← 新增
  return { phase: 'PLAN' };
}
```

### log 命名規則

```
contract-pass-{ts}.log    ← gate 通過
contract-error-{ts}.log   ← gate 失敗（BLOCKER）
```

---

## 實作清單

1. `sdid-tools/blueprint-contract-writer.cjs` — gate 驗證 + 存 log
2. `sdid-core/state-machine.cjs` — inferStateFromLogs 加 contract-pass 判斷
3. `sdid-tools/mcp-server/adapters/loop.mjs` — 加 CONTRACT case
4. `sdid-tools/draft-to-plan.cjs` — resolveContractTypes() + 骨架注入
5. `sdid-core/state-machine.cjs` — buildNextCommand 加 CONTRACT
