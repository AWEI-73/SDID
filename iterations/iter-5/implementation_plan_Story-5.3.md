# Implementation Plan - Story-5.3

**迭代**: iter-5  
**Story ID**: Story-5.3  
**日期**: 2025-12-11  
**目標模組**: dashboard (門控結果面板)

> 📋 **放置位置**: `iterations/iter-5/implementation_plan_Story-5.3.md`

---

## 1. Story 目標

**一句話目標**: 建立門控結果面板 UI，視覺化顯示 GEMS Gate 和 Test Gate 結果，讓使用者即時了解專案健康狀態

**範圍**:
- ✅ 包含: GEMS Gate 結果顯示、Test Gate 結果顯示、函式統計圖表、警告/錯誤清單
- ❌ 不包含: 檔案瀏覽器（Story-5.2）、工具操作面板（Story-5.1）

**關聯用戶故事**: US-5.3 (門控監控)

---

## 2. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | Reports 頁面 HTML | FRONTEND | P1 | ✅ 明確 | 2h |
| 2 | Gate 結果 JS 模組 | FRONTEND | P1 | ✅ 明確 | 3h |
| 3 | 後端 Gate API | BACKEND | P1 | ✅ 明確 | 2h |

**執行順序**: Item 3 → Item 1 → Item 2

---

## 3. Item 詳細規格

### Item 1: Reports 頁面 HTML

**Type**: FRONTEND | **Priority**: P1

**功能描述**: 建立 Reports 頁面的 HTML 結構，包含 GEMS Gate 和 Test Gate 結果卡片

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `public/index.html` | Modify | 新增 Reports 頁面內容 |

**UI 結構**:
```html
<div id="page-reports" class="page hidden">
  <h2>📊 Gate Reports</h2>
  
  <!-- Path Bar -->
  <div class="path-bar">
    <label>專案路徑：</label>
    <input type="text" id="report-path" placeholder="/path/to/project" />
    <button id="btn-load-report">Analyze</button>
  </div>
  
  <!-- Summary Cards -->
  <div class="summary-grid">
    <!-- GEMS Gate Card -->
    <div class="summary-card" id="card-gems-gate">
      <h3>🚦 GEMS Gate</h3>
      <div class="status-badge" id="gems-gate-status">--</div>
      <div class="stats-row">
        <span>Total Functions: <strong id="gems-total">0</strong></span>
        <span>Coverage: <strong id="gems-coverage">0%</strong></span>
      </div>
    </div>
    
    <!-- Test Gate Card -->
    <div class="summary-card" id="card-test-gate">
      <h3>🧪 Test Gate</h3>
      <div class="status-badge" id="test-gate-status">--</div>
      <div class="stats-row">
        <span>Passed: <strong id="test-passed">0</strong></span>
        <span>Missing: <strong id="test-missing">0</strong></span>
      </div>
    </div>
  </div>
  
  <!-- Priority Distribution -->
  <div class="chart-section">
    <h3>📈 Priority Distribution</h3>
    <div class="priority-chart" id="priority-chart">
      <div class="bar-container">
        <div class="bar-label">P0</div>
        <div class="bar p0" id="bar-p0"></div>
        <div class="bar-value" id="val-p0">0</div>
      </div>
      <div class="bar-container">
        <div class="bar-label">P1</div>
        <div class="bar p1" id="bar-p1"></div>
        <div class="bar-value" id="val-p1">0</div>
      </div>
      <div class="bar-container">
        <div class="bar-label">P2</div>
        <div class="bar p2" id="bar-p2"></div>
        <div class="bar-value" id="val-p2">0</div>
      </div>
      <div class="bar-container">
        <div class="bar-label">P3</div>
        <div class="bar p3" id="bar-p3"></div>
        <div class="bar-value" id="val-p3">0</div>
      </div>
    </div>
  </div>
  
  <!-- Issues List -->
  <div class="issues-section">
    <h3>⚠️ Issues</h3>
    <div class="issues-tabs">
      <button class="tab active" data-tab="errors">Errors</button>
      <button class="tab" data-tab="warnings">Warnings</button>
    </div>
    <div id="issues-list" class="issues-list">
      <!-- Dynamic issue items -->
    </div>
  </div>
</div>
```

**驗收標準**:
- AC-5.3.1: Reports 頁面有路徑輸入和分析按鈕
- AC-5.3.2: GEMS Gate 和 Test Gate 各有獨立卡片
- AC-5.3.3: 顯示 Priority 分佈條形圖
- AC-5.3.4: Issues 區有 Errors 和 Warnings 分頁

---

### Item 2: Gate 結果 JS 模組

**Type**: FRONTEND | **Priority**: P1

**功能描述**: 建立 reports.js 模組，處理 Gate 結果渲染和圖表更新

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `public/js/modules/reports.js` | New | 實作報告頁面邏輯 |

**核心函式**:
| 函式 | Priority | 說明 |
|------|----------|------|
| `initReportsPage` | P1 | 初始化報告頁面 |
| `loadGateResults` | P1 | 載入 Gate 結果 |
| `renderGemsGate` | P1 | 渲染 GEMS Gate 卡片 |
| `renderTestGate` | P1 | 渲染 Test Gate 卡片 |
| `renderPriorityChart` | P1 | 渲染 Priority 條形圖 |
| `renderIssuesList` | P1 | 渲染錯誤/警告清單 |
| `switchIssueTab` | P2 | 切換 Issues 分頁 |

**驗收標準**:
- AC-5.3.5: GEMS Gate 狀態正確顯示 PASSED/FAILED
- AC-5.3.6: Test Gate 狀態正確顯示 PASSED/FAILED
- AC-5.3.7: Priority 條形圖動態調整寬度
- AC-5.3.8: Issues 清單可切換 Errors/Warnings
- AC-5.3.9: 無結果時顯示「暫無資料」

---

### Item 3: 後端 Gate API

**Type**: BACKEND | **Priority**: P1

**功能描述**: 實作 getGateResults 函式，整合 gems-scanner 和 gems-test-gate 結果

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `src/modules/dashboard/services/toolService.ts` | Modify | 新增 getGateResults 函式 |
| `src/modules/dashboard/api/routes.ts` | Modify | 確保 GET /api/gate 路由正確 |

**核心函式**:
| 函式 | Priority | 說明 |
|------|----------|------|
| `getGateResults` | P1 | 取得完整 Gate 結果 |
| `parseScanner Result` | P2 | 解析 gems-scanner 輸出 |
| `parseTestGateResult` | P2 | 解析 gems-test-gate 輸出 |

**驗收標準**:
- AC-5.3.10: GET /api/gate?path=xxx 回傳 GateResult
- AC-5.3.11: 整合 gems-scanner 的函式統計
- AC-5.3.12: 整合 gems-test-gate 的覆蓋率結果
- AC-5.3.13: 回傳完整的 errors 和 warnings 清單

---

## 4. 資料契約

```typescript
// @GEMS-STORY: Story-5.3 (門控結果面板)

// @GEMS-CONTRACT: GateResult (已定義於 Story-5.0，擴展)
interface GateResult {
  passed: boolean;
  timestamp: string;
  scanner: ScannerResult;
  testGate: TestGateResult;
  issues: Issue[];
}

// @GEMS-CONTRACT: ScannerResult
interface ScannerResult {
  total: number;          // 總函式數
  tagged: number;         // 已標籤數
  untagged: number;       // 未標籤數
  byPriority: {
    P0: number;
    P1: number;
    P2: number;
    P3: number;
  };
  coverage: number;       // 標籤覆蓋率 (%)
}

// @GEMS-CONTRACT: TestGateResult
interface TestGateResult {
  passed: number;         // 測試覆蓋的函式數
  missing: number;        // 缺少測試的函式數
  coverage: number;       // 測試覆蓋率 (%)
  missingTests: string[]; // 缺少測試的函式清單
}

// @GEMS-CONTRACT: Issue
interface Issue {
  type: 'error' | 'warning';
  code: string;           // 錯誤代碼，如 GEMS-001
  message: string;
  file?: string;
  line?: number;
  function?: string;
}
```

---

## 5. UI 規格 (@GEMS-UI)

```
GEMS-UI: ReportsPage (Dashboard) | Zones: [PathBar, SummaryCards, ChartSection, IssuesSection]

SummaryCards (Grid 2-col):
├── GemsGateCard:
│   ├── StatusBadge: PASSED (green) / FAILED (red)
│   └── Stats: Total + Coverage
└── TestGateCard:
    ├── StatusBadge: PASSED (green) / FAILED (red)
    └── Stats: Passed + Missing

ChartSection:
└── PriorityChart: 水平條形圖 (P0=red, P1=orange, P2=yellow, P3=gray)

IssuesSection:
├── Tabs: [Errors, Warnings]
└── IssuesList:
    └── IssueItem: [Type] [Code] - [Message] @ [File:Line]
```

---

## 6. 業務流程 (GEMS-FLOW)

```
EnterPath → ClickAnalyze → ShowLoading → FetchGateAPI → 
  ├── RenderGemsGate
  ├── RenderTestGate
  ├── RenderPriorityChart
  └── RenderIssues
```

---

## 7. 檔案結構定義

```json
{
  "fileStructure": {
    "modules": [
      {
        "id": "reports-frontend",
        "path": "public/js/modules",
        "files": [
          {
            "name": "reports.js",
            "type": "component",
            "functions": [
              { "name": "initReportsPage", "priority": "P1" },
              { "name": "loadGateResults", "priority": "P1" },
              { "name": "renderGemsGate", "priority": "P1" },
              { "name": "renderTestGate", "priority": "P1" },
              { "name": "renderPriorityChart", "priority": "P1" },
              { "name": "renderIssuesList", "priority": "P1" },
              { "name": "switchIssueTab", "priority": "P2" }
            ]
          }
        ]
      },
      {
        "id": "reports-backend",
        "path": "src/modules/dashboard/services",
        "files": [
          {
            "name": "toolService.ts",
            "type": "service",
            "functions": [
              { "name": "getGateResults", "priority": "P1" },
              { "name": "parseScannerResult", "priority": "P2" },
              { "name": "parseTestGateResult", "priority": "P2" }
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
| gems-scanner.cjs | internal | GEMS 標籤掃描工具 |
| gems-test-gate.cjs | internal | 測試覆蓋檢查工具 |

---

## 9. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **複雜度檢核** | ✅ 通過 | 整合現有工具，無新依賴 |
| **封裝檢核** | ✅ 通過 | 前後端分離，API 清晰 |
| **P0 函式檢核** | ✅ 通過 | 無 P0 函式，全為 P1/P2 |

---

## 10. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| 大型專案分析慢 | Medium | Loading 狀態 + 進度提示 |
| Scanner 輸出格式變更 | Medium | 版本檢查 + 錯誤處理 |
| Issues 清單太長 | Low | 分頁 + 摘要顯示 |

---

**產出日期**: 2025-12-11 | **Agent**: PLAN
