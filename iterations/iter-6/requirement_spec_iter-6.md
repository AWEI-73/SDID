# Requirement Specification - iter-6

**迭代**: iter-6  
**日期**: 2025-12-12  
**目標**: 流程自動化與節點卡控強化 + 骨架內嵌標籤

> 📋 **放置位置**: `iterations/iter-6/requirement_spec_iter-6.md`  
> 🎨 **POC 驗證**: `iterations/iter-6/POC-iter-6.html`

---

## 1. 迭代目標

**一句話目標**: 讓每個節點都能「按一下」產生對應的樣板/骨架，**骨架直接內嵌 GEMS 標籤**，讓 BUILD 流程直接受益

**範圍**:
- ✅ 包含: 節點操作按鈕、POC/PLAN/BUILD/SCAN 節點工具、**骨架內嵌 GEMS 標籤**
- ❌ 不包含: 多專案管理、遠端備份、智能函式注入（iter-8 POC）

---

## 2. 用戶故事

### US-6.1: POC 初始化
**As a** 開發者  
**I want** 在 POC 節點點擊「開始 POC」按鈕  
**So that** 自動產生新迭代資料夾和 POC 樣板檔案

### US-6.2: PLAN 樣板產生
**As a** 開發者  
**I want** 在 PLAN 節點點擊「產生樣板」按鈕  
**So that** 從 requirement_spec 自動判斷 Story 數量並產生對應的 implementation_plan

### US-6.3: BUILD 骨架產生
**As a** 開發者  
**I want** 在 BUILD 節點點擊「Scaffold」按鈕  
**So that** 從 implementation_plan 自動產生程式碼骨架（含完整 GEMS 標籤）

### US-6.4: SCAN 與備份
**As a** 開發者  
**I want** 在 SCAN 節點點擊「Scan」和「Backup」按鈕  
**So that** 執行專案掃描並備份當前迭代

### US-6.5: 備份管理
**As a** 開發者  
**I want** 在 UI 上查看和管理備份列表  
**So that** 可以手動檢視/刪除不需要的備份

### US-6.6: 骨架內嵌標籤 ⭐ 核心價值
**As a** 開發者  
**I want** Scaffold 產生的程式碼骨架直接包含完整的 GEMS 標籤  
**So that** BUILD 階段 Agent 只需專注實作邏輯，標籤已預先注入

---

## 3. Stories 規劃

| Story | 名稱 | Type | Priority | 說明 |
|-------|------|------|:--------:|------|
| Story-6.0 | 節點按鈕基礎建設 | INFRASTRUCTURE | P0 | UI 按鈕框架、事件綁定 |
| Story-6.1 | POC 節點工具 | FEATURE | P0 | init-poc.cjs + UI 整合 |
| Story-6.2 | PLAN 節點工具 | FEATURE | P0 | generate-plan-templates.cjs + 清理邏輯 |
| Story-6.3 | BUILD 節點工具 + **骨架標籤** | FEATURE | P0 | sync-scaffold.cjs + **骨架內嵌 GEMS 標籤** ⭐ |
| Story-6.4 | SCAN 節點工具 | FEATURE | P1 | backup-iteration.cjs + 備份管理 UI |

> ⭐ **Story-6.3 核心價值**: 骨架直接包含 GEMS 標籤，BUILD 時 Agent 只需填入實作邏輯

---

## 4. 資料契約

### 4.1 UI 資料契約 (參見 POC-iter-6.html)

```typescript
// @GEMS-CONTRACT: NodeAction
// @GEMS-TABLE: N/A (UI only)
interface NodeAction {
  nodeId: 'POC' | 'PLAN' | 'BUILD' | 'SCAN';  // 節點識別
  buttonId: string;                           // 按鈕 ID
  label: string;                              // 按鈕文字
  icon: string;                               // Emoji icon
  handler: () => void;                        // 點擊處理
  isPrimary: boolean;                         // 是否為主按鈕
}

// @GEMS-CONTRACT: BackupItem
// @GEMS-TABLE: N/A (file system)
interface BackupItem {
  id: string;                                 // UUID
  iterationNumber: number;                    // iter-X
  timestamp: string;                          // ISO 8601
  size: number;                               // bytes
  path: string;                               // backup folder path
  contents: string[];                         // ['src/', 'docs/', ...]
}

// @GEMS-CONTRACT: BackupSummary
interface BackupSummary {
  count: number;                              // 備份數量
  totalSize: number;                          // bytes
  items: BackupItem[];
}
```

### 4.2 工具資料契約

```typescript
// @GEMS-CONTRACT: InitPocResult
interface InitPocResult {
  success: boolean;
  iterationNumber: number;
  createdFiles: string[];    // ['requirement_spec_iter-6.md', 'POC.html', ...]
  createdDir: string;        // 'iterations/iter-6/'
}

// @GEMS-CONTRACT: GeneratePlanResult
interface GeneratePlanResult {
  success: boolean;
  storyCount: number;
  createdFiles: string[];    // ['implementation_plan_Story-6.0.md', ...]
  cleanedFiles: string[];    // 被清理的空 POC 樣板
}

// @GEMS-CONTRACT: ScaffoldResult
interface ScaffoldResult {
  success: boolean;
  created: { path: string; gemsCount: number }[];
  skipped: { path: string; reason: string }[];
  summary: {
    totalCreated: number;
    totalSkipped: number;
    totalGemsTags: number;
  }
}

// @GEMS-CONTRACT: BackupResult
interface BackupResult {
  success: boolean;
  backupPath: string;
  size: number;
  timestamp: string;
}
```

---

## 5. UI 規格

### 5.1 節點卡片設計

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ [🚀 開始]    │    │ [📋 產生樣板]│   │ [📁 Scaffold]│   │ [🔍] [💾]   │  ← 按鈕在卡片內上方
├─────────────┤    ├─────────────┤    ├─────────────┤    ├─────────────┤
│ POC    ●待執行│ →│ PLAN   ●待執行│ →│ BUILD  ●待執行│ →│ SCAN   ●待執行│
│ 概念驗證      │    │ 實作規劃      │    │ 程式實作      │    │ 規格產出      │
│ Step 0-3     │    │ Plan Items   │    │ Phase 1-7    │    │ Full Spec    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

- 按鈕放在卡片內部上方
- 當前可執行步驟使用 primary 按鈕（藍色）
- 其他使用 secondary 按鈕（灰色）
```

### 5.2 備份管理區塊

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 💾 備份管理                                                    [📁 開啟資料夾] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📊 總覽: 3 個備份 | 總大小: 45.2 MB                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │ iter-5 / 2025-12-11_071800    25.1 MB    [👁️ 查看] [🗑️] │                │
│  │ iter-4 / 2025-12-10_153000    12.3 MB    [👁️ 查看] [🗑️] │                │
│  │ iter-3 / 2025-12-09_120000     7.8 MB    [👁️ 查看] [🗑️] │                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                              │
│  ⚠️ 備份不會自動清理，請手動管理                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 迭代顯示

```
流程狀態（點擊節點展開詳情） 目前位於 iter-5
```

---

## 6. 工具規格

### 6.1 新增工具

| 工具 | 功能 | 對應節點 |
|------|------|----------|
| `init-poc.cjs` | 產生 POC 樣板（資料夾 + 檔案） | POC |
| `generate-plan-templates.cjs` | 從 spec 產生 plan 樣板 | PLAN |
| `sync-scaffold.cjs` | 從 plan 產生 code 骨架 | BUILD |
| `backup-iteration.cjs` | 備份迭代 | SCAN |

### 6.2 工具詳細規格

#### init-poc.cjs
```bash
node tools/init-poc.cjs --project <path> [--iteration <number>]
```
**功能**:
- 建立 `iterations/iter-X/` 資料夾
- 產生 `requirement_spec_iter-X.md` 樣板
- 產生 `POC.html` 樣板

#### generate-plan-templates.cjs
```bash
node tools/generate-plan-templates.cjs --project <path> --iteration <number>
```
**功能**:
- 解析 `requirement_spec_iter-X.md`
- 計算 Story 數量
- 產生對應的 `implementation_plan_Story-X.Y.md`
- 產生 `todo_checklist_iter-X.md`
- 清理空的 POC 樣板

#### sync-scaffold.cjs
```bash
node tools/sync-scaffold.cjs --plan <plan-file>
```
**功能**:
- 解析 `implementation_plan` 的 fileStructure
- 偵測現有專案結構
- 產生缺少的檔案（含完整 GEMS 標籤）
- 產出報告（新建/略過）

**樣板格式** (完整 GEMS 標籤):
```typescript
/**
 * GEMS: functionName | P1 | ✓✓ | (params)→ReturnType | Story-X.Y | 函式說明
 * GEMS-FLOW: Step1→Step2→Step3
 * GEMS-DEPS:
 *   - [internal] dependency1
 *   - [shared] dependency2
 * GEMS-TEST: □ Unit
 * GEMS-TEST-FILE: [filename].test.ts
 */
export function functionName(params: ParamType): ReturnType {
    // TODO: implement
    throw new Error('Not implemented');
}
```

**衝突策略**: 檔案層級
- 新檔案 → 產生
- 已存在 → 略過（記錄到報告）

#### backup-iteration.cjs
```bash
node tools/backup-iteration.cjs --project <path> --iteration <number>
```
**功能**:
- 備份 `src/`、`docs/`、`iterations/iter-X/`
- 儲存到 `control-tower/backups/iter-X/[timestamp]/`
- 回傳備份資訊

---

## 7. 驗收標準

### AC-6.0: 節點按鈕基礎建設
- [ ] 每個節點卡片內上方有對應的操作按鈕
- [ ] 按鈕點擊不會觸發卡片展開
- [ ] 按鈕狀態（primary/secondary）根據流程狀態切換
- [ ] 流程狀態標題旁顯示「目前位於 iter-X」

### AC-6.1: POC 節點工具
- [ ] 點擊「開始 POC」呼叫 init-poc.cjs
- [ ] 自動建立新迭代資料夾
- [ ] 產生 requirement_spec 和 POC 樣板
- [ ] 成功後顯示產出清單

### AC-6.2: PLAN 節點工具
- [ ] 點擊「產生樣板」呼叫 generate-plan-templates.cjs
- [ ] 從 requirement_spec 解析 Story 數量
- [ ] 產生對應數量的 implementation_plan
- [ ] 清理空的 POC 樣板

### AC-6.3: BUILD 節點工具
- [ ] 點擊「Scaffold」呼叫 sync-scaffold.cjs
- [ ] 從 implementation_plan 產生 code 骨架
- [ ] 骨架包含完整 GEMS 標籤
- [ ] 已存在檔案略過不覆蓋
- [ ] 顯示新建/略過報告

### AC-6.4: SCAN 節點工具
- [ ] 點擊「Scan」執行 GEMS Scanner
- [ ] 點擊「Backup」執行 backup-iteration.cjs
- [ ] 備份儲存到 backups/ 目錄

### AC-6.5: 備份管理 UI
- [ ] 顯示備份總覽（數量、總大小）
- [ ] 列表顯示所有備份
- [ ] 可查看備份內容
- [ ] 可刪除備份
- [ ] 不自動清理

---

## 8. API 規格

### 8.1 新增 API Endpoints

| Method | Path | 功能 |
|--------|------|------|
| POST | `/api/poc/init` | 初始化 POC |
| POST | `/api/plan/generate-templates` | 產生 PLAN 樣板 |
| POST | `/api/build/scaffold` | 產生 code 骨架 |
| POST | `/api/scan/backup` | 備份迭代 |
| GET | `/api/backups` | 取得備份列表 |
| DELETE | `/api/backups/:id` | 刪除備份 |

---

## 9. 依賴關係

| 依賴 | 類型 | 說明 |
|------|------|------|
| Express Server | internal | 現有後端 API |
| 現有工具 | internal | scaffold-files.cjs 等 |
| fs-extra | external | 檔案操作 |

---

## 10. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| 規格書解析失敗 | Medium | 提供錯誤訊息指引 |
| 骨架覆蓋現有檔案 | High | **絕對不覆蓋**，只產生新檔案 |
| 備份占用空間 | Low | 手動管理，不自動清理 |
| 工具執行錯誤 | Medium | 詳細錯誤訊息 + rollback |

---

## 11. POC 檔案

- **UI POC**: `iterations/iter-6/POC-iter-6.html`
  - 節點按鈕設計驗證
  - 備份管理區塊驗證
  - 可雙擊直接開啟

---

## 12. 獨立可測性 (Independent Testability)

每個 Story 可獨立驗證：

| Story | 獨立測試方式 |
|-------|-------------|
| 6.0 | 點擊按鈕確認不展開卡片 |
| 6.1 | 執行 init-poc.cjs 確認產出 |
| 6.2 | 執行 generate-plan-templates.cjs 確認產出 |
| 6.3 | 執行 sync-scaffold.cjs 確認骨架產生 |
| 6.4 | 執行 backup-iteration.cjs 確認備份 |

---

**產出日期**: 2025-12-11 | **Agent**: POC → PLAN
