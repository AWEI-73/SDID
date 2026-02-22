# Implementation Plan - Story-9.1

**迭代**: iter-9  
**Story ID**: Story-9.1  
**日期**: 2025-12-18  
**目標模組**: viz (Visualizer)

> 📋 **放置位置**: `iterations/iter-9/implementation_plan_Story-9.1.md`

---

## 1. Story 目標

**一句話目標**: 實作 System Blueprint Visualizer，整合專案結構、配置、資料庫 Schema 與業務流程的可視化工具

**範圍**:
- ✅ 包含: 資料聚合器、Blueprint API、前端整合、層級導航 UI
- ❌ 不包含: DB Scanner 自動掃描（列為 P1 後續任務）、搜尋功能、匯出功能

---

## 2. 模組資訊

- **模組名稱**: viz
- **模組類型**: standard
- **模組路徑**: src/modules/viz
- **是否新模組**: ❌ 否（已存在，需擴充）
- **是否為基礎建設 (Story-1.0)**: ❌ 否

---

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | 建立 Spec Aggregator 工具 | FEATURE | P0 | ✅ 明確 | 2-3h |
| 2 | 實作 Blueprint API | FEATURE | P0 | ✅ 明確 | 2-3h |
| 3 | 前端整合 Blueprint UI | FEATURE | P0 | ✅ 明確 | 3-4h |

**執行順序**: Item 1 → Item 2 → Item 3

---

## 4. Item 詳細規格

### Item 1: 建立 Spec Aggregator 工具

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 建立資料聚合工具，整合 Scanner 產出的多個 JSON 檔案為統一的 `system-blueprint.json`

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `tools/spec-aggregator.cjs` | New | 資料聚合主程式 |
| `tools/__tests__/spec-aggregator.test.cjs` | New | Unit Test |

**核心函式**:
1. `aggregateSpecs(docsPath)` - 讀取並整合所有 Scanner 產出
2. `buildSystemTree(structure, spec, config, schema)` - 建立層級樹狀結構
3. `mergeModuleData(structureNode, specFunctions)` - 合併模組與函式資料

**實作邏輯**:
```javascript
// GEMS-FLOW: ReadFiles→ParseJSON→BuildTree→MergeData→WriteOutput
async function aggregateSpecs(docsPath) {
  // [STEP] 1. 讀取檔案
  const structure = readJSON(`${docsPath}/structure.json`);
  const config = readJSON(`${docsPath}/config.json`);
  const spec = readJSON(`${docsPath}/Full_Project_Spec.json`);
  const schema = readJSON(`${docsPath}/schema.json`, { optional: true });
  
  // [STEP] 2. 建立樹狀結構
  const systemTree = buildSystemTree(structure, spec, config, schema);
  
  // [STEP] 3. 寫入輸出
  writeJSON(`${docsPath}/system-blueprint.json`, systemTree);
}
```

**驗收標準**:
- AC-9.1.1: 執行 `node tools/spec-aggregator.cjs --docs=.gems/docs` 成功產出 `system-blueprint.json`
- AC-9.1.2: 產出的 JSON 符合 POC 中定義的 `SystemNode` 介面
- AC-9.1.3: 若 `schema.json` 不存在，不應報錯，Database 節點為空陣列

---

### Item 2: 實作 Blueprint API

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 建立 Backend API 提供系統藍圖資料給前端

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `src/modules/viz/api/blueprintRoutes.ts` | New | API 路由定義 |
| `src/modules/viz/services/blueprintService.ts` | New | 業務邏輯層 |
| `src/modules/viz/services/__tests__/blueprintService.test.ts` | New | Unit Test |
| `src/main.ts` | Modify | 註冊 Blueprint 路由 |

**核心函式**:
1. `getSystemBlueprint(projectPath)` - 讀取或生成系統藍圖
2. `ensureBlueprintExists(projectPath)` - 確保藍圖檔案存在

**API 規格**:
```typescript
// @GEMS-CONTRACT: SystemBlueprint
// @GEMS-TABLE: N/A (檔案系統)
interface SystemBlueprint {
  success: boolean;
  data: SystemNode;
  generatedAt: string;
}

// GET /api/viz/blueprint?project={path}
```

**實作邏輯**:
```typescript
// GEMS-FLOW: CheckFile→(NotExist?RunAggregator)→ReadJSON→Return
export async function getSystemBlueprint(projectPath: string): Promise<SystemNode> {
  const blueprintPath = path.join(projectPath, '.gems/docs/system-blueprint.json');
  
  // [STEP] 1. 檢查檔案是否存在
  if (!fs.existsSync(blueprintPath)) {
    // [STEP] 2. 執行 Aggregator
    await runAggregator(projectPath);
  }
  
  // [STEP] 3. 讀取並回傳
  return JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));
}
```

**驗收標準**:
- AC-9.1.4: `GET /api/viz/blueprint` 回傳正確的 JSON 結構
- AC-9.1.5: 若藍圖不存在，自動執行 Aggregator 後回傳
- AC-9.1.6: API 錯誤處理正確（檔案不存在、JSON 格式錯誤）

---

### Item 3: 前端整合 Blueprint UI

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 將 POC 的 UI 邏輯整合到 Control Tower，替換 MOCK_DATA 為真實 API

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `public/js/modules/blueprint.js` | New | Blueprint 前端模組 |
| `public/index.html` | Modify | 新增 Blueprint 頁面容器與導航 |
| `public/js/modules/navigation.js` | Modify | 新增 Blueprint 路由 |

**核心函式**:
1. `BlueprintView.init()` - 初始化 Blueprint 頁面
2. `BlueprintView.loadData()` - 從 API 載入資料
3. `BlueprintView.renderTree(node, container)` - 渲染樹狀結構
4. `BlueprintView.renderDetail(node)` - 渲染詳細視圖

**UI 規格**:
```
// @GEMS-UI: BlueprintPage (Split-View) | Zones: [Sidebar, Content]
// Sidebar: Tree Navigation
// Content: Detail View (Project/Database/Module/Script)
```

**實作邏輯**:
```javascript
// GEMS-FLOW: FetchAPI→RenderTree→BindEvents→Ready
const BlueprintView = {
  async init() {
    // [STEP] 1. 載入資料
    const data = await this.loadData();
    
    // [STEP] 2. 渲染樹狀結構
    this.renderTree(data, document.getElementById('blueprint-sidebar'));
    
    // [STEP] 3. 預設選中根節點
    this.renderDetail(data);
  },
  
  async loadData() {
    const res = await fetch('/api/viz/blueprint');
    const json = await res.json();
    return json.data;
  }
};
```

**驗收標準**:
- AC-9.1.7: 點擊導航列的 "Blueprint" 按鈕，正確載入頁面
- AC-9.1.8: 左側樹狀結構正確顯示 Project → Database/Modules
- AC-9.1.9: 點擊樹狀節點，右側顯示對應的詳細視圖
- AC-9.1.10: Database 視圖正確渲染 Mermaid ER Diagram（若有 schema.json）

---

## 5. 規格注入 (基於 POC)

### 5.1 資料契約 (@GEMS-CONTRACT)

```typescript
// @GEMS-STORY: Story-9.1
// @GEMS-CONTRACT: SystemNode
// @GEMS-DESC: 系統藍圖節點結構（遞迴）
interface SystemNode {
  name: string;
  type: 'project' | 'database' | 'module' | 'script' | 'function' | 'config-group';
  desc?: string;
  path?: string;
  stats?: {
    modules: number;
    scripts: number;
    functions: number;
    tables: number;
  };
  config?: {
    constants: string[];
    hardcoded: number;
  };
  tables?: DatabaseTable[];
  erDiagram?: string;
  functions?: FunctionNode[];
  children?: SystemNode[];
  scripts?: SystemNode[];
}

interface FunctionNode {
  name: string;
  type: 'function';
  tag?: 'P0' | 'P1' | 'API';
  desc?: string;
  flow?: string[];
}

interface DatabaseTable {
  name: string;
  desc: string;
  columns: {
    name: string;
    type: string;
    flags: string[];
  }[];
}
```

### 5.2 UI 規格 (@GEMS-UI)

```
GEMS-UI: BlueprintPage (Split-View) | Zones: [TreeSidebar, DetailContent]
  ├── TreeSidebar: 層級導航（可展開/摺疊）
  └── DetailContent: 詳細視圖（根據節點類型動態渲染）
      ├── ProjectView: 統計卡片 + Config 警告
      ├── DatabaseView: ER Diagram + Tables
      ├── ModuleView: Scripts 列表
      └── ScriptView: Functions + Flow Steps
```

### 5.3 業務流程 (GEMS-FLOW)

**Aggregator**:
```
GEMS-FLOW: ReadFiles→ParseJSON→BuildTree→MergeData→WriteOutput
```

**API**:
```
GEMS-FLOW: CheckFile→(NotExist?RunAggregator)→ReadJSON→Return
```

**Frontend**:
```
GEMS-FLOW: FetchAPI→RenderTree→BindEvents→Ready
```

---

## 6. 檔案結構定義 (供 sync-scaffold 使用)

```json
{
  "fileStructure": {
    "tools": [
      {
        "name": "spec-aggregator.cjs",
        "type": "tool",
        "functions": [
          {
            "name": "aggregateSpecs",
            "priority": "P0",
            "testTypes": ["Unit"]
          }
        ]
      }
    ],
    "modules": [
      {
        "id": "viz",
        "path": "src/modules/viz",
        "isNew": false,
        "files": [
          {
            "name": "api/blueprintRoutes.ts",
            "type": "route"
          },
          {
            "name": "services/blueprintService.ts",
            "type": "service",
            "functions": [
              {
                "name": "getSystemBlueprint",
                "priority": "P0",
                "testTypes": ["Unit", "Integration"]
              }
            ]
          }
        ],
        "tests": [
          {
            "name": "services/__tests__/blueprintService.test.ts",
            "covers": ["getSystemBlueprint"]
          }
        ]
      }
    ],
    "frontend": [
      {
        "name": "public/js/modules/blueprint.js",
        "type": "module"
      }
    ]
  }
}
```

---

## 7. 依賴關係

| 依賴 | 類型 | 說明 |
|------|------|------|
| `structure-scanner.cjs` | tool | 產出 structure.json |
| `config-scanner.cjs` | tool | 產出 config.json |
| `gems-scanner.cjs` | tool | 產出 Full_Project_Spec.json |
| `schema-parser.cjs` | tool | 產出 schema.json（可選） |
| `mermaid.js` | lib (CDN) | 前端渲染 ER Diagram |
| `lucide-icons` | lib (CDN) | 前端圖標 |

---

## 8. 架構審查 (Constitution Audit) - **Mandatory**

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **複雜度檢核** | ✅ 通過 | 無新依賴，僅使用現有 Scanner 工具 |
| **封裝檢核** | ✅ 通過 | Aggregator 為獨立工具，Service 層職責單一 |
| **P0 函式檢核** | ✅ 通過 | 主要函式 3 個（aggregateSpecs, getSystemBlueprint, BlueprintView.init） |

---

## 9. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scanner 產出格式變更 | Medium | Aggregator 加入格式驗證與錯誤處理 |
| Mermaid 圖表過大導致渲染緩慢 | Low | 限制 ER Diagram 複雜度，或提供摺疊功能 |
| 前端 MOCK_DATA 與真實資料結構不一致 | Low | 基於 POC 的 CONTRACT 開發，已驗證 |

---

**產出日期**: 2025-12-18 | **Agent**: PLAN
