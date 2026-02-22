# iter-6 POC 規劃

**建立日期**: 2025-12-11  
**更新日期**: 2025-12-11 07:18  
**狀態**: 待開始  
**目標**: 流程自動化與節點卡控強化

---

## 🎯 迭代目標

強化 GEMS Flow 的**文檔規範**、**節點操作按鈕**、**自動化 Scaffold** 和 **SCAN 備份**功能。

---

## 📐 UI 設計

### 流程狀態區域

```
流程狀態（點擊節點展開詳情） 目前位於 iter-5

┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ [🚀 開始]    │    │ [📋 產生樣板]│    │ [📁 Scaffold]│   │ [🔍] [💾]   │  ← 按鈕在卡片內上方
├─────────────┤    ├─────────────┤    ├─────────────┤    ├─────────────┤
│ POC    ●待執行│ →│ PLAN   ●待執行│ →│ BUILD  ●待執行│ →│ SCAN   ●待執行│
│ 概念驗證      │    │ 實作規劃      │    │ 程式實作      │    │ 規格產出      │
│ Step 0-3     │    │ Plan Items   │    │ Phase 1-7    │    │ Full Spec    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 備份管理區塊

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

---

## 📋 各節點功能詳細

### 🔵 POC 節點

#### 按鈕: `[� 開始POC]`

**觸發時機**: 開始新迭代前

**功能**:
1. 建立新迭代資料夾 `iterations/iter-X/`
2. 產生 POC 相關樣板

**產出物**:
```
iterations/iter-X/
├── requirement_spec_iter-X.md    ← 需求規格範本
├── POC.html                      ← UI 原型範本
└── [Name]Contract.ts             ← 契約範本
```

**待討論**:
- POC 觸發需要先輸入什麼資訊？（專案名稱？模組名稱？）
- 是否需要選擇 POC 模式（有 UI / 無 UI）？

---

### 🟢 PLAN 節點

#### 按鈕: `[📋 產生樣板]`

**觸發時機**: 確定 requirement_spec 後，開始 PLAN 前

**功能**:
1. 讀取 `requirement_spec_iter-X.md`
2. 判斷 Story 數量
3. 產出對應的 implementation_plan 樣板
4. 產出 todo_checklist
5. **清理邏輯**: 檢查 POC 樣板狀態
   - 如果有 POC 內容 → 保留
   - 如果只有樣板（空殼）→ 刪除

**產出物**:
```
iterations/iter-X/
├── implementation_plan_Story-X.0.md   ← 基礎建設（如有）
├── implementation_plan_Story-X.1.md   ← Story 1
├── implementation_plan_Story-X.2.md   ← Story 2
├── ...
├── todo_checklist_iter-X.md           ← 待辦清單
└── [刪除空的 POC 樣板]
```

**判斷邏輯**:
```
從 requirement_spec 解析:
- 如果有「基礎建設」相關描述 → 產出 Story-X.0
- 統計 Story 數量 → 產出對應數量的 implementation_plan
```

---

### 🟡 BUILD 節點

#### 按鈕: `[📁 Scaffold]`

**觸發時機**: 開始 BUILD 前

**功能**:
1. 讀取 `implementation_plan` 的 `fileStructure`
2. 偵測現有專案結構
3. 建立缺少的資料夾
4. 產出 CODE 模板（含完整 GEMS 標籤）

**樣板格式**: B 完整標籤

```typescript
/**
 * GEMS: createReport | P1 | ✓✓ | (data)→Report | Story-6.1 | 建立報告
 * GEMS-FLOW: Validate→Transform→Save→Return
 * GEMS-DEPS:
 *   - [internal] validateData
 *   - [shared] ReportContract
 * GEMS-TEST: □ Unit
 * GEMS-TEST-FILE: reportService.test.ts
 */
export function createReport(data: ReportInput): Report {
    // TODO: implement
    throw new Error('Not implemented');
}
```

**衝突策略**: 檔案層級
- 新檔案 → 產生
- 已存在 → 略過（記錄到報告）

**產出物**:
```
src/modules/[new-module]/
├── index.ts
├── services/
│   └── [name]Service.ts
├── api/
│   └── routes.ts
└── __tests__/
    └── [name]Service.test.ts
```

---

### 🔴 SCAN 節點

#### 按鈕 1: `[🔍 Scan]`

**觸發時機**: BUILD 完成後（可自動或手動）

**功能**:
1. 執行 GEMS Scanner
2. 執行 Test Gate
3. 產出規格書

**產出物**:
```
docs/
├── Full_Project_Spec.json
├── Full_Project_Spec.md
├── structure.json
└── config.json
```

#### 按鈕 2: `[💾 Backup]`

**觸發時機**: 迭代完成後

**功能**:
1. 備份當前迭代相關檔案

**產出物**:
```
control-tower/
└── backups/
    └── iter-X/
        └── 2025-12-11_071800/
            ├── src/                  ← 程式碼快照
            ├── docs/                 ← 規格書
            └── iterations/iter-X/    ← 迭代文檔
```

**擴充**: BUILD 完成後可自動觸發備份

---

## 📊 Scaffold 報告格式

```
┌────────────────────────────────────────────────────────┐
│  📋 Scaffold Sync Report - Story-6.1                   │
├────────────────────────────────────────────────────────┤
│  📊 總覽                                               │
│     新建: 3 | 略過: 2 | 衝突: 0                         │
├────────────────────────────────────────────────────────┤
│  📁 新建檔案:                                          │
│     ┌────────────────────────────────────────────┐     │
│     │ 📄 src/modules/reports/index.ts            │     │
│     │    GEMS: 2 個函式 (P1: 1, P2: 1)           │     │
│     │    [預覽] [開啟檔案]                        │     │
│     └────────────────────────────────────────────┘     │
│                                                        │
│  ⏭️ 略過檔案 (需手動確認):                              │
│     ┌────────────────────────────────────────────┐     │
│     │ 📄 src/modules/core/index.ts (已存在)      │     │
│     │    💡 請對照 implementation_plan 確認      │     │
│     │    [開啟規格] [開啟檔案]                    │     │
│     └────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────┘
```

---

## 🔧 工具需求

### 新增工具

| 工具 | 功能 | 對應節點 |
|------|------|----------|
| `init-poc.cjs` | 產生 POC 樣板 | POC |
| `generate-plan-templates.cjs` | 從 spec 產生 plan 樣板 | PLAN |
| `sync-scaffold.cjs` | 從 plan 產生 code 骨架 | BUILD |
| `backup-iteration.cjs` | 備份迭代 | SCAN |

### 修改工具

| 工具 | 修改內容 |
|------|----------|
| `scaffold-files.cjs` | 整合完整 GEMS 標籤樣板 |
| `run-all-scanners.cjs` | 加入備份觸發 |

---

## 📂 Story 拆分建議

| Story | 名稱 | Priority | 說明 |
|-------|------|:--------:|------|
| 6.0 | 節點按鈕基礎建設 | P0 | UI 按鈕框架、迭代選擇器 |
| 6.1 | POC 節點工具 | P0 | init-poc.cjs |
| 6.2 | PLAN 節點工具 | P0 | generate-plan-templates.cjs、清理邏輯 |
| 6.3 | BUILD 節點工具 | P1 | sync-scaffold.cjs、完整標籤樣板 |
| 6.4 | SCAN 節點工具 | P1 | backup-iteration.cjs、自動觸發 |

---

## 📝 待討論事項

1. **POC 觸發**: 需要先輸入什麼資訊？
   - 只需迭代編號？
   - 還是需要模組名稱？

2. **按鈕啟用邏輯**: 是否根據節點狀態啟用/停用按鈕？
   - 例如：POC 完成前，PLAN 按鈕灰色？

3. **Scaffold 來源**: 
   - 讀取哪個 `implementation_plan`？（最新？選擇？）

---

## 📝 備註

- iter-5 經驗：**建議先做 UI POC**，對齊預期後再開發
- 節點按鈕是核心功能，應優先實作
- 樣板選擇 B 方案（完整 GEMS 標籤）
- 衝突策略：檔案層級，新建略舊

---

**最後更新**: 2025-12-11 07:18
