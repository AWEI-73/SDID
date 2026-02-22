# Implementation Plan - Story-4.1

**迭代**: iter-4  
**Story ID**: Story-4.1  
**日期**: 2025-12-10  
**目標模組**: project-init (專案初始化)

> 📋 **放置位置**: `iterations/iter-4/implementation_plan_Story-4.1.md`

---

## 1. 迭代目標

**一句話目標**: 建立專案初始化工具，自動複製 GEMS 基礎設施到新專案

**範圍**:
- ✅ 包含: 專案初始化腳本、配置檔範本、橫向分層結構產生
- ❌ 不包含: 模組骨架產生（Story-4.2）、Story 編號判斷（Story-4.3）

---

## 2. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | init-project.cjs | FEATURE | P0 | ✅ 明確 | 3-4h |
| 2 | 配置檔範本 | QUALITY | P0 | ✅ 明確 | 1h |

**執行順序**: Item 1 → Item 2

---

## 3. Item 詳細規格

### Item 1: init-project.cjs

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 複製 GEMS 基礎設施到新專案，產生專案配置檔和橫向分層結構

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `tools/init-project.cjs` | New | 專案初始化腳本 |
| `tools/__tests__/init-project.test.cjs` | New | Unit Test |

**核心函式**:
1. `validateProjectPath(path)` - 驗證專案路徑
2. `checkGemsExists(path)` - 檢查 .gems/ 是否已存在
3. `copyGemsInfrastructure(sourcePath, targetPath)` - 複製 GEMS 基礎設施
4. `generateProjectConfig(projectName, projectPath)` - 產生專案配置檔
5. `createHorizontalLayers(projectPath)` - 產生橫向分層結構
6. `generateReport(result)` - 產出初始化報告

**驗收標準**:
- AC-4.1.1: 執行 `node tools/init-project.cjs --path=/path/to/MMS --name=MMS`
- AC-4.1.2: 自動複製 `.gems/` 目錄到目標專案
- AC-4.1.3: 產生 `.gems/config.json` 配置檔
- AC-4.1.4: 產生橫向分層結構（src/config, src/assets, src/lib, src/shared, src/modules, src/routes）
- AC-4.1.5: 若 `.gems/` 已存在則報錯，不覆蓋
- AC-4.1.6: 產出報告包含：複製的檔案數量、產生的資料夾清單

---

### Item 2: 配置檔範本

**Type**: QUALITY  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 建立專案配置檔範本

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `docs/templates/config.template.json` | New | 專案配置範本 |

**範本內容**:
```json
{
  "projectName": "{PROJECT_NAME}",
  "projectPath": "{PROJECT_PATH}",
  "gemsVersion": "4.0",
  "currentIteration": 1,
  "currentStory": "",
  "modules": [],
  "createdAt": "{CREATED_AT}"
}
```

**驗收標準**:
- AC-4.1.7: 新增 `config.template.json` 範本
- AC-4.1.8: 範本包含專案名稱、路徑、版本、迭代編號等欄位
- AC-4.1.9: 使用 `{變數}` 格式標記可替換部分

---

## 4. 規格注入

### 4.1 資料契約 (@GEMS-CONTRACT)

```typescript
// @GEMS-STORY: Story-4.1 (專案初始化模組)

// @GEMS-CONTRACT: ProjectConfig
interface ProjectConfig {
  projectName: string;      // 專案名稱
  projectPath: string;      // 專案路徑
  gemsVersion: string;      // GEMS 版本
  currentIteration: number; // 當前迭代編號
  currentStory: string;     // 當前 Story ID
  modules: ModuleInfo[];    // 模組清單
  createdAt: string;        // 建立時間
}

// @GEMS-CONTRACT: ModuleInfo
interface ModuleInfo {
  name: string;             // 模組名稱（例: meal-management）
  type: 'standard' | 'complex'; // 模組類型
  storyId: string;          // 關聯的 Story ID（例: Story-2.0）
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;        // 建立時間
}

// @GEMS-CONTRACT: InitResult
interface InitResult {
  success: boolean;
  projectPath: string;
  copiedFiles: number;
  createdFolders: string[];
  configPath: string;
  errors: string[];
}
```

### 4.2 業務流程 (GEMS-FLOW)

```
ValidateProjectPath→CheckGemsExists→CopyGemsInfrastructure→GenerateProjectConfig→CreateHorizontalLayers→GenerateReport
```

---

## 5. 檔案結構定義

```json
{
  "fileStructure": {
    "modules": [
      {
        "id": "project-init",
        "path": "control-tower/tools",
        "files": [
          {
            "name": "init-project.cjs",
            "type": "util",
            "functions": [
              {
                "name": "validateProjectPath",
                "priority": "P0",
                "testTypes": ["Unit"]
              },
              {
                "name": "checkGemsExists",
                "priority": "P0",
                "testTypes": ["Unit"]
              },
              {
                "name": "copyGemsInfrastructure",
                "priority": "P0",
                "testTypes": ["Unit", "Integration"]
              },
              {
                "name": "generateProjectConfig",
                "priority": "P0",
                "testTypes": ["Unit"]
              },
              {
                "name": "createHorizontalLayers",
                "priority": "P0",
                "testTypes": ["Unit"]
              }
            ]
          }
        ],
        "tests": [
          {
            "name": "__tests__/init-project.test.cjs",
            "covers": ["validateProjectPath", "checkGemsExists", "copyGemsInfrastructure", "generateProjectConfig", "createHorizontalLayers"]
          }
        ]
      },
      {
        "id": "templates",
        "path": "control-tower/docs/templates",
        "files": [
          {
            "name": "config.template.json",
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
| control-tower/.gems/ | internal | GEMS 基礎設施來源 |

---

## 7. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **複雜度檢核** | ✅ 通過 | 無新依賴，純 Node.js 內建模組 |
| **封裝檢核** | ✅ 通過 | 工具腳本，封裝適當 |
| **P0 函式檢核** | ✅ 通過 | 5 個核心函式，符合規範 |

---

## 8. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| 路徑不存在 | High | 驗證路徑存在性 + 錯誤處理 |
| 權限不足 | Medium | 檢查寫入權限 + 清楚錯誤訊息 |
| .gems/ 已存在 | High | 檢查後報錯，不覆蓋 |

---

**產出日期**: 2025-12-10 | **Agent**: PLAN
