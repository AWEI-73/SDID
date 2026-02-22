# Implementation Plan - Story-5.0

**迭代**: iter-5  
**Story ID**: Story-5.0  
**日期**: 2025-12-11  
**目標模組**: dashboard (UI 基礎架構強化)

> 📋 **放置位置**: `iterations/iter-5/implementation_plan_Story-5.0.md`

---

## 1. Story 目標

**一句話目標**: 建立後端 API 並重構前端 UI 架構，支援側邊欄導航和模組化 JS

**範圍**:
- ✅ 包含: 後端 API 擴展、前端 HTML 重構、前端 JS 模組化
- ❌ 不包含: 工具操作面板 UI（Story-5.1）、檔案瀏覽器（Story-5.2）

---

## 2. 工作項目

| Item | 名稱 | Type | Priority | 預估 |
|------|------|------|:--------:|:----:|
| 1 | 後端 API 擴展 | BACKEND | P1 | 1h |
| 2 | 前端 HTML 重構 | FRONTEND | P1 | 2h |
| 3 | 前端 JS 模組化 | FRONTEND | P1 | 2h |

**執行順序**: Item 1 → Item 2 → Item 3

---

## 3. Item 詳細規格

### Item 1: 後端 API 擴展

**Type**: BACKEND | **Priority**: P1

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `src/modules/dashboard/services/toolService.ts` | New | 工具執行服務 |
| `src/modules/dashboard/services/fileService.ts` | New | 檔案瀏覽服務 |
| `src/modules/dashboard/api/routes.ts` | Modify | 新增 API routes |

**核心函式**:
| 函式 | Priority | 說明 |
|------|----------|------|
| `executeInitProject` | P1 | 執行 init-project 工具 |
| `executeScaffold` | P1 | 執行 scaffold-files 工具 |
| `executeGate` | P1 | 執行 GEMS Gate |
| `executeStoryAdvisor` | P2 | 執行 Story 編號建議 |
| `getFileTree` | P1 | 取得檔案樹 |
| `getGateResults` | P1 | 取得門控結果 |
| `readFileContent` | P2 | 讀取檔案內容 |

---

### Item 2: 前端 HTML 重構

**Type**: FRONTEND | **Priority**: P1

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `public/index.html` | Modify | 重構 layout，加入側邊欄 |

**UI 結構**:
```html
<body>
  <div id="app" class="flex h-screen">
    <!-- Sidebar -->
    <aside id="sidebar" class="w-64 bg-[#1c1c1c]">
      <nav id="nav-menu">
        <button data-page="dashboard">📊 Dashboard</button>
        <button data-page="tools">🛠 Tools</button>
        <button data-page="files">📁 Files</button>
        <button data-page="reports">📊 Reports</button>
      </nav>
    </aside>
    
    <!-- Main Content -->
    <main id="main-content" class="flex-1">
      <div id="page-dashboard" class="page active">...</div>
      <div id="page-tools" class="page hidden">...</div>
      <div id="page-files" class="page hidden">...</div>
      <div id="page-reports" class="page hidden">...</div>
    </main>
    
    <!-- Toast Container -->
    <div id="toast-container"></div>
  </div>
</body>
```

---

### Item 3: 前端 JS 模組化

**Type**: FRONTEND | **Priority**: P1

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `public/js/api.js` | New | API 呼叫模組 |
| `public/js/modules/navigation.js` | New | 導航模組 |
| `public/js/modules/toast.js` | New | Toast 通知模組 |
| `public/js/modules/dashboard.js` | New | Dashboard 頁面模組 |
| `public/js/modules/tools.js` | New | Tools 頁面模組（骨架） |
| `public/js/modules/files.js` | New | Files 頁面模組（骨架） |
| `public/app.js` | Modify | 重構為入口，引入各模組 |

---

## 4. 資料契約

```typescript
// @GEMS-CONTRACT: ToolResult
interface ToolResult {
  success: boolean;
  message: string;
  output?: string;
  error?: string;
}

// @GEMS-CONTRACT: FileNode
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
}

// @GEMS-CONTRACT: GateResult
interface GateResult {
  passed: boolean;
  scanner: { total: number; byPriority: Record<string, number>; };
  testGate: { passed: number; missing: number; };
  coverage: number;
}
```

---

## 5. API 路由

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/tools/init-project` | 初始化專案 |
| POST | `/api/tools/scaffold` | 產生骨架 |
| POST | `/api/tools/gate` | 執行 GEMS Gate |
| POST | `/api/tools/story-advisor` | Story 編號建議 |
| GET | `/api/files` | 取得檔案樹 |
| GET | `/api/files/content` | 讀取檔案內容 |
| GET | `/api/gate` | 取得門控結果 |

---

## 6. 驗收標準

| AC | 說明 |
|----|------|
| AC-5.0.1 | 新增 API 正常回應（7 個 endpoints） |
| AC-5.0.2 | 側邊欄可切換 4 個頁面 |
| AC-5.0.3 | 頁籤切換無頁面刷新 |
| AC-5.0.4 | Toast 通知正常顯示 |
| AC-5.0.5 | TypeScript 編譯 0 errors |
| AC-5.0.6 | 現有測試全部通過 |

---

## 7. 檔案結構定義

```json
{
  "fileStructure": {
    "modules": [
      {
        "id": "dashboard-services",
        "path": "src/modules/dashboard/services",
        "files": [
          { "name": "toolService.ts", "type": "service" },
          { "name": "fileService.ts", "type": "service" }
        ]
      },
      {
        "id": "public-js",
        "path": "public/js",
        "files": [
          { "name": "api.js", "type": "util" },
          { "name": "modules/navigation.js", "type": "component" },
          { "name": "modules/toast.js", "type": "component" },
          { "name": "modules/dashboard.js", "type": "component" },
          { "name": "modules/tools.js", "type": "component" },
          { "name": "modules/files.js", "type": "component" }
        ]
      }
    ]
  }
}
```

---

**產出日期**: 2025-12-11 | **Agent**: PLAN
