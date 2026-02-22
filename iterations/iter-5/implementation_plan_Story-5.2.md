# Implementation Plan - Story-5.2

**迭代**: iter-5  
**Story ID**: Story-5.2  
**日期**: 2025-12-11  
**目標模組**: dashboard (檔案瀏覽器)

> 📋 **放置位置**: `iterations/iter-5/implementation_plan_Story-5.2.md`

---

## 1. Story 目標

**一句話目標**: 建立檔案瀏覽器 UI，讓使用者可以視覺化瀏覽專案檔案結構並預覽檔案內容

**範圍**:
- ✅ 包含: 樹狀檔案結構、資料夾展開/收合、檔案預覽
- ❌ 不包含: 檔案編輯功能、工具操作面板（Story-5.1）

**關聯用戶故事**: US-5.2 (檔案瀏覽)

---

## 2. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | 檔案瀏覽器 HTML | FRONTEND | P1 | ✅ 明確 | 2h |
| 2 | 檔案瀏覽器 JS 模組 | FRONTEND | P1 | ✅ 明確 | 3h |
| 3 | 後端 API 實作 | BACKEND | P1 | ✅ 明確 | 2h |

**執行順序**: Item 3 → Item 1 → Item 2

---

## 3. Item 詳細規格

### Item 1: 檔案瀏覽器 HTML

**Type**: FRONTEND | **Priority**: P1

**功能描述**: 建立 Files 頁面的 HTML 結構，包含樹狀顯示區和檔案預覽區

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `public/index.html` | Modify | 新增 Files 頁面內容 |

**UI 結構**:
```html
<div id="page-files" class="page hidden">
  <h2>📁 File Browser</h2>
  
  <!-- Path Bar -->
  <div class="path-bar">
    <label>專案路徑：</label>
    <input type="text" id="file-path" placeholder="/path/to/project" />
    <button id="btn-load-files">Load</button>
    <button id="btn-refresh-files">🔄 Refresh</button>
  </div>
  
  <div class="file-browser-container">
    <!-- File Tree Panel -->
    <div class="file-tree-panel">
      <div id="file-tree" class="tree-view">
        <!-- Dynamic tree content -->
        <div class="tree-loading">Loading...</div>
      </div>
    </div>
    
    <!-- File Preview Panel -->
    <div class="file-preview-panel">
      <div class="preview-header">
        <span id="preview-filename">No file selected</span>
        <span id="preview-size"></span>
      </div>
      <pre id="file-preview-content" class="preview-content">
        Select a file to preview its content
      </pre>
    </div>
  </div>
</div>
```

**驗收標準**:
- AC-5.2.1: Files 頁面有路徑輸入和載入按鈕
- AC-5.2.2: 左側為檔案樹面板、右側為預覽面板
- AC-5.2.3: 佈局響應式，小螢幕時上下排列

---

### Item 2: 檔案瀏覽器 JS 模組

**Type**: FRONTEND | **Priority**: P1

**功能描述**: 建立 files.js 模組，處理檔案樹渲染和檔案預覽

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `public/js/modules/files.js` | Modify | 實作檔案瀏覽邏輯 |

**核心函式**:
| 函式 | Priority | 說明 |
|------|----------|------|
| `initFilesPage` | P1 | 初始化檔案頁面 |
| `loadFileTree` | P1 | 載入檔案樹結構 |
| `renderTreeNode` | P1 | 遞迴渲染樹節點 |
| `toggleFolder` | P1 | 展開/收合資料夾 |
| `previewFile` | P1 | 預覽檔案內容 |
| `getFileIcon` | P2 | 根據副檔名取得 icon |

**驗收標準**:
- AC-5.2.4: 樹狀結構正確顯示目錄和檔案
- AC-5.2.5: 點擊資料夾可展開/收合
- AC-5.2.6: 點擊檔案顯示預覽內容
- AC-5.2.7: 不同檔案類型顯示不同 icon
- AC-5.2.8: 載入中顯示 Loading 狀態

---

### Item 3: 後端 API 實作

**Type**: BACKEND | **Priority**: P1

**功能描述**: 實作 fileService.ts 中的檔案系統操作邏輯

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `src/modules/dashboard/services/fileService.ts` | Modify | 實作檔案服務函式 |
| `src/modules/dashboard/api/routes.ts` | Modify | 確保 API 路由正確 |

**核心函式**:
| 函式 | Priority | 說明 |
|------|----------|------|
| `getFileTree` | P1 | 取得檔案樹結構 |
| `readFileContent` | P2 | 讀取檔案內容 |
| `buildTreeNode` | P1 | 建立樹節點物件 |
| `filterIgnoredFiles` | P2 | 過濾 .git, node_modules 等 |

**驗收標準**:
- AC-5.2.9: GET /api/files?path=xxx 回傳 FileNode 樹
- AC-5.2.10: GET /api/files/content?path=xxx 回傳檔案內容
- AC-5.2.11: 自動過濾 .git, node_modules 等目錄
- AC-5.2.12: 大檔案返回部分內容 + 警告

---

## 4. 資料契約

```typescript
// @GEMS-STORY: Story-5.2 (檔案瀏覽器)

// @GEMS-CONTRACT: FileNode (已定義於 Story-5.0)
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
  size?: number;
}

// @GEMS-CONTRACT: FileTreeRequest
interface FileTreeRequest {
  path: string;       // 專案根目錄路徑
  maxDepth?: number;  // 最大掃描深度，預設 5
}

// @GEMS-CONTRACT: FileContentRequest
interface FileContentRequest {
  path: string;       // 完整檔案路徑
  maxSize?: number;   // 最大讀取大小 (bytes)，預設 100KB
}

// @GEMS-CONTRACT: FileContentResponse
interface FileContentResponse {
  path: string;
  content: string;
  size: number;
  truncated: boolean;
  encoding: string;
}
```

---

## 5. UI 規格 (@GEMS-UI)

```
GEMS-UI: FilesPage (SplitView) | Zones: [PathBar, TreePanel, PreviewPanel]

PathBar:
├── PathInput: 專案路徑輸入
├── LoadButton: 載入按鈕
└── RefreshButton: 重新整理按鈕

TreePanel:
├── TreeRoot: 根節點
│   ├── FolderNode: 可展開的資料夾 (🗂️)
│   │   └── [nested children]
│   └── FileNode: 可點擊的檔案 (📄)
└── EmptyState: 無檔案時顯示

PreviewPanel:
├── Header: 檔名 + 檔案大小
└── Content: 語法高亮的內容預覽 (pre)
```

---

## 6. 業務流程 (GEMS-FLOW)

```
EnterPath → LoadTree → DisplayTree → ClickNode
  ├── IsFolder → ToggleExpand
  └── IsFile → LoadContent → DisplayPreview
```

---

## 7. 檔案結構定義

```json
{
  "fileStructure": {
    "modules": [
      {
        "id": "files-frontend",
        "path": "public/js/modules",
        "files": [
          {
            "name": "files.js",
            "type": "component",
            "functions": [
              { "name": "initFilesPage", "priority": "P1" },
              { "name": "loadFileTree", "priority": "P1" },
              { "name": "renderTreeNode", "priority": "P1" },
              { "name": "toggleFolder", "priority": "P1" },
              { "name": "previewFile", "priority": "P1" },
              { "name": "getFileIcon", "priority": "P2" }
            ]
          }
        ]
      },
      {
        "id": "files-backend",
        "path": "src/modules/dashboard/services",
        "files": [
          {
            "name": "fileService.ts",
            "type": "service",
            "functions": [
              { "name": "getFileTree", "priority": "P1" },
              { "name": "readFileContent", "priority": "P2" },
              { "name": "buildTreeNode", "priority": "P1" },
              { "name": "filterIgnoredFiles", "priority": "P2" }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 8. 依賴關係

| 依賴 | 類型 | 說明 |
|------|------|------|
| Story-5.0 | internal | 需要側邊欄導航和 Toast 系統 |
| api.js | internal | 前端 API 呼叫模組 |
| Node.js fs | lib | 檔案系統操作 |
| Node.js path | lib | 路徑處理 |

---

## 9. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **複雜度檢核** | ✅ 通過 | 無新依賴，使用 Node.js 內建模組 |
| **封裝檢核** | ✅ 通過 | 前後端分離清晰 |
| **P0 函式檢核** | ✅ 通過 | 無 P0 函式，全為 P1/P2 |

---

## 10. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| 大型專案載入慢 | Medium | 限制掃描深度 + Lazy loading |
| 大檔案預覽卡頓 | Medium | 限制讀取大小 + 虛擬滾動考慮 |
| 路徑注入攻擊 | High | 路徑驗證 + 白名單限制 |
| 二進位檔案預覽 | Low | 偵測二進位 + 顯示「無法預覽」 |

---

**產出日期**: 2025-12-11 | **Agent**: PLAN
