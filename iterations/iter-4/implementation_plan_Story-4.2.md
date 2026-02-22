# Implementation Plan - Story-4.2

**迭代**: iter-4  
**Story ID**: Story-4.2  
**日期**: 2025-12-10  
**目標模組**: scaffold-generator (腳手架產生)

> 📋 **放置位置**: `iterations/iter-4/implementation_plan_Story-4.2.md`

---

## 1. 迭代目標

**一句話目標**: 擴展 scaffold-files.cjs，支援 Module 0 (skeleton mode) 和 Module N (full mode) 的檔案骨架產生

**範圍**:
- ✅ 包含: 擴展 scaffold-files.cjs、建立 skeleton templates、支援模式切換
- ❌ 不包含: 專案初始化（Story-4.1）、Story 編號判斷（Story-4.3）

---

## 2. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | 擴展 scaffold-files.cjs | FEATURE | P0 | ✅ 明確 | 4-5h |
| 2 | Skeleton Templates | QUALITY | P0 | ✅ 明確 | 2-3h |

**執行順序**: Item 2 → Item 1 (先建立 templates，再擴展工具)

---

## 3. Item 詳細規格

### Item 1: 擴展 scaffold-files.cjs

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 擴展現有的 scaffold-files.cjs，新增 --mode 參數支援 skeleton 和 full 模式

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `tools/scaffold-files.cjs` | Modify | 擴展現有工具 |
| `tools/__tests__/scaffold-files.test.cjs` | Modify | 更新測試 |

**新增函式**:
1. `detectMode(planContent)` - 自動偵測模式（根據 Story 編號）
2. `loadSkeletonTemplate(templateType)` - 載入 skeleton template
3. `generateSkeletonFile(filePath, template, vars)` - 產生 skeleton 檔案

**修改函式**:
1. `loadTemplate(templateType, mode)` - 新增 mode 參數
2. `main()` - 新增 --mode 參數解析

**驗收標準**:
- AC-4.2.1: 支援 `--mode=skeleton` 參數，產生空範本檔案
- AC-4.2.2: 支援 `--mode=full` 參數，產生完整檔案骨架（現有功能）
- AC-4.2.3: 若未指定 mode，自動偵測（Story-X.0 → skeleton, Story-X.1+ → full）
- AC-4.2.4: skeleton mode 產生的檔案只有 GEMS 標籤範例，無函數實作
- AC-4.2.5: full mode 產生的檔案包含函數簽名 + GEMS 標籤
- AC-4.2.6: 更新測試覆蓋新增的函式

---

### Item 2: Skeleton Templates

**Type**: QUALITY  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 建立 Module 0 專用的 skeleton templates

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `docs/templates/code/skeleton/config.skeleton.ts` | New | Config 空範本 |
| `docs/templates/code/skeleton/layout.skeleton.tsx` | New | Layout 空範本 |
| `docs/templates/code/skeleton/component.skeleton.tsx` | New | Component 空範本 |
| `docs/templates/code/skeleton/store.skeleton.ts` | New | Store 空範本 |

**範本內容要求**:
- 只包含 GEMS 標籤範例
- 包含 `// TODO: Implement in BUILD phase` 註解
- 使用 `{變數}` 格式標記可替換部分

**範例** (config.skeleton.ts):
```typescript
/**
 * GEMS: {ModuleName} | P[0-3] | ○○ | -→- | Story-X.0 | {Description}
 * GEMS-FLOW: -
 * GEMS-DEPS: []
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: - Unit | - Integration | - E2E
 * GEMS-TEST-FILE: -
 */

// TODO: Implement in BUILD phase

export {};
```

**驗收標準**:
- AC-4.2.7: 新增 4 個 skeleton template 檔案
- AC-4.2.8: 每個 template 包含完整 GEMS 標籤範例
- AC-4.2.9: 每個 template 包含 TODO 註解
- AC-4.2.10: 使用 `{變數}` 格式標記可替換部分

---

## 4. 規格注入

### 4.1 資料契約 (@GEMS-CONTRACT)

```typescript
// @GEMS-STORY: Story-4.2 (腳手架產生模組)

// @GEMS-CONTRACT: ScaffoldMode
type ScaffoldMode = 'skeleton' | 'full';

// @GEMS-CONTRACT: ScaffoldOptions
interface ScaffoldOptions {
  planPath: string;
  mode?: ScaffoldMode;
  dryRun?: boolean;
  force?: boolean;
}

// @GEMS-CONTRACT: ScaffoldResult
interface ScaffoldResult {
  success: boolean;
  mode: ScaffoldMode;
  generated: string[];
  skipped: string[];
  errors: string[];
}
```

### 4.2 業務流程 (GEMS-FLOW)

```
ParseArgs→DetectMode→ReadPlan→ParseJSON→CheckExisting→LoadTemplate(mode)→GenerateFiles→Report
```

---

## 5. 檔案結構定義

```json
{
  "fileStructure": {
    "modules": [
      {
        "id": "scaffold-generator",
        "path": "control-tower/tools",
        "files": [
          {
            "name": "scaffold-files.cjs",
            "type": "util",
            "functions": [
              {
                "name": "detectMode",
                "priority": "P0",
                "testTypes": ["Unit"]
              },
              {
                "name": "loadSkeletonTemplate",
                "priority": "P0",
                "testTypes": ["Unit"]
              },
              {
                "name": "generateSkeletonFile",
                "priority": "P0",
                "testTypes": ["Unit"]
              }
            ]
          }
        ],
        "tests": [
          {
            "name": "__tests__/scaffold-files.test.cjs",
            "covers": ["detectMode", "loadSkeletonTemplate", "generateSkeletonFile"]
          }
        ]
      },
      {
        "id": "skeleton-templates",
        "path": "control-tower/docs/templates/code/skeleton",
        "files": [
          {
            "name": "config.skeleton.ts",
            "type": "util"
          },
          {
            "name": "layout.skeleton.tsx",
            "type": "util"
          },
          {
            "name": "component.skeleton.tsx",
            "type": "util"
          },
          {
            "name": "store.skeleton.ts",
            "type": "util"
          }
        ],
        "tests": []
      }
    ]
  }
}
```

---

## 6. 依賴關係

| 依賴 | 類型 | 說明 |
|------|------|------|
| Node.js fs | lib | 檔案系統操作 |
| Node.js path | lib | 路徑處理 |
| tools/scaffold-files.cjs | internal | 現有工具（修改） |
| docs/templates/code/*.template.* | internal | 現有 templates |

---

## 7. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **複雜度檢核** | ✅ 通過 | 擴展現有工具，無新依賴 |
| **封裝檢核** | ✅ 通過 | 新增函式封裝適當 |
| **P0 函式檢核** | ✅ 通過 | 3 個新增函式，符合規範 |

---

## 8. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| 破壞現有功能 | High | 完整測試覆蓋 + 向後相容 |
| Template 路徑錯誤 | Medium | 路徑驗證 + 錯誤處理 |
| Mode 偵測錯誤 | Medium | Unit Test 覆蓋所有情境 |

---

**產出日期**: 2025-12-10 | **Agent**: PLAN
