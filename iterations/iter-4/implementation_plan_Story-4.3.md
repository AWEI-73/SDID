# Implementation Plan - Story-4.3

**迭代**: iter-4  
**Story ID**: Story-4.3  
**日期**: 2025-12-10  
**目標模組**: story-advisor (Story 編號判斷)

> 📋 **放置位置**: `iterations/iter-4/implementation_plan_Story-4.3.md`

---

## 1. 迭代目標

**一句話目標**: 建立 Story 編號判斷工具，自動判斷是否需要 X.0（基礎建設）或 X.1+（功能開發）

**範圍**:
- ✅ 包含: Story 編號判斷腳本、專案結構偵測、建議報告產生
- ❌ 不包含: 專案初始化（Story-4.1）、腳手架產生（Story-4.2）

---

## 2. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | story-number-advisor.cjs | FEATURE | P1 | ✅ 明確 | 3-4h |

**執行順序**: Item 1

---

## 3. Item 詳細規格

### Item 1: story-number-advisor.cjs

**Type**: FEATURE  
**Priority**: P1  
**明確度**: ✅ 明確

**功能描述**: 偵測專案結構，判斷是否需要 X.0（基礎建設）或 X.1+（功能開發）

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `tools/story-number-advisor.cjs` | New | Story 編號判斷工具 |
| `tools/__tests__/story-number-advisor.test.cjs` | New | Unit Test |

**核心函式**:
1. `detectProjectStructure(projectPath)` - 偵測專案結構
2. `checkModuleExists(projectPath, moduleName)` - 檢查模組是否存在
3. `detectArchitectureChange(projectPath, description)` - 偵測架構變更
4. `suggestStoryNumber(projectPath, moduleName, description)` - 建議 Story 編號
5. `generateAdviceReport(result)` - 產生建議報告

**判斷邏輯**:
```
需要 X.0（基礎建設）:
1. 新增模組資料夾（src/modules/[new-module]/）
2. 架構層級調整（例: 新增 src/shared/layouts/）
3. 依賴關係重構

不需要 X.0（功能開發）:
1. 在既有模組新增功能
2. 修改現有檔案
3. 新增工具腳本（在 tools/ 目錄）
```

**驗收標準**:
- AC-4.3.1: 執行 `node tools/story-number-advisor.cjs --project=/path/to/MMS --module=meal-management`
- AC-4.3.2: 若模組資料夾不存在，建議使用 Story-X.0（基礎建設）
- AC-4.3.3: 若模組資料夾已存在，建議使用 Story-X.1+（功能開發）
- AC-4.3.4: 產生建議報告，包含：建議編號、理由、相關檔案清單
- AC-4.3.5: 支援 `--description` 參數，根據描述偵測架構變更
- AC-4.3.6: 支援 `--json` 參數，輸出 JSON 格式報告

---

## 4. 規格注入

### 4.1 資料契約 (@GEMS-CONTRACT)

```typescript
// @GEMS-STORY: Story-4.3 (Story 編號判斷模組)

// @GEMS-CONTRACT: StoryAdvice
interface StoryAdvice {
  suggestedNumber: string;  // 例: "Story-2.0" 或 "Story-2.1"
  reason: string;           // 建議理由
  needsInfrastructure: boolean; // 是否需要基礎建設
  relatedFiles: string[];   // 相關檔案清單
  architectureChanges: string[]; // 架構變更清單
}

// @GEMS-CONTRACT: ProjectStructure
interface ProjectStructure {
  projectPath: string;
  hasGemsConfig: boolean;
  modules: string[];        // 已存在的模組清單
  currentIteration: number;
  lastStoryNumber: string;  // 最後一個 Story 編號
}

// @GEMS-CONTRACT: AdvisorOptions
interface AdvisorOptions {
  projectPath: string;
  moduleName?: string;
  description?: string;
  json?: boolean;
}
```

### 4.2 業務流程 (GEMS-FLOW)

```
ParseArgs→DetectProjectStructure→CheckModuleExists→DetectArchitectureChange→SuggestStoryNumber→GenerateAdviceReport
```

---

## 5. 檔案結構定義

```json
{
  "fileStructure": {
    "modules": [
      {
        "id": "story-advisor",
        "path": "control-tower/tools",
        "files": [
          {
            "name": "story-number-advisor.cjs",
            "type": "util",
            "functions": [
              {
                "name": "detectProjectStructure",
                "priority": "P1",
                "testTypes": ["Unit"]
              },
              {
                "name": "checkModuleExists",
                "priority": "P1",
                "testTypes": ["Unit"]
              },
              {
                "name": "detectArchitectureChange",
                "priority": "P1",
                "testTypes": ["Unit"]
              },
              {
                "name": "suggestStoryNumber",
                "priority": "P1",
                "testTypes": ["Unit"]
              }
            ]
          }
        ],
        "tests": [
          {
            "name": "__tests__/story-number-advisor.test.cjs",
            "covers": ["detectProjectStructure", "checkModuleExists", "detectArchitectureChange", "suggestStoryNumber"]
          }
        ]
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
| .gems/config.json | internal | 專案配置（讀取） |

---

## 7. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **複雜度檢核** | ✅ 通過 | 無新依賴，純 Node.js 內建模組 |
| **封裝檢核** | ✅ 通過 | 工具腳本，封裝適當 |
| **P1 函式檢核** | ✅ 通過 | 4 個核心函式，符合規範 |

---

## 8. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| 誤判模組類型 | Medium | 完整測試覆蓋 + 清楚判斷邏輯 |
| 配置檔不存在 | Low | 檢查配置檔存在性 + 錯誤處理 |
| 架構變更偵測錯誤 | Medium | 關鍵字匹配 + 人工確認 |

---

**產出日期**: 2025-12-10 | **Agent**: PLAN
