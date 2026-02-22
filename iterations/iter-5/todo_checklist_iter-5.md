# Todo Checklist - iter-5

**迭代**: iter-5  
**目標**: Control Tower UI 強化  
**日期**: 2025-12-11

---

## Story-5.0: UI 基礎架構強化

### Item 1: 後端 API 擴展
- [ ] Phase 1: 開發 toolService.ts
- [ ] Phase 2: 開發 fileService.ts
- [ ] Phase 3: 擴展 routes.ts
- [ ] Phase 4: 測試腳本
- [ ] Phase 5: TDD 測試
- [ ] Phase 6: 標籤驗收
- [ ] Phase 7: Test Gate

### Item 2: 前端 HTML 重構
- [ ] Phase 1: 側邊欄結構
- [ ] Phase 2: 頁籤容器
- [ ] Phase 3: Toast 容器
- [ ] Phase 4: 樣式調整
- [ ] Phase 5: 手動測試

### Item 3: 前端 JS 模組化
- [ ] Phase 1: 建立 public/js 目錄
- [ ] Phase 2: 建立 api.js
- [ ] Phase 3: 建立 navigation.js
- [ ] Phase 4: 建立 toast.js
- [ ] Phase 5: 建立 dashboard.js
- [ ] Phase 6: 建立 tools.js
- [ ] Phase 7: 建立 files.js
- [ ] Phase 8: 重構 app.js
- [ ] Phase 9: 手動測試

### Story-5.0 完成
- [ ] GEMS Gate 通過
- [ ] 產出 Fillback_Story-5.0.md

---

## Story-5.1: 工具操作面板 (待 Story-5.0 完成)

### Item 1: 工具面板 HTML (P0)
- [ ] 新增 Tools 頁面結構到 index.html
- [ ] 4 個工具卡片佈局 (Init/Scaffold/Gate/Advisor)
- [ ] 響應式 Grid 佈局

### Item 2: 工具操作 JS 模組 (P0)
- [ ] 實作 initToolsPage()
- [ ] 實作 handleInitProject() - Init Project 表單處理
- [ ] 實作 handleScaffold() - Scaffold Files 表單處理
- [ ] 實作 handleGate() - GEMS Gate 表單處理
- [ ] 實作 handleStoryAdvisor() - Story Advisor 表單處理
- [ ] 實作 displayToolOutput() - 結果顯示
- [ ] Loading 狀態和錯誤處理

### Item 3: 後端 API 整合 (P0)
- [ ] 實作 executeInitProject() in toolService.ts
- [ ] 實作 executeScaffold() in toolService.ts
- [ ] 實作 executeGate() in toolService.ts
- [ ] 實作 executeStoryAdvisor() in toolService.ts
- [ ] 驗證 API 回傳 ToolResult 格式

### Story-5.1 完成
- [ ] GEMS Gate 通過
- [ ] 產出 Fillback_Story-5.1.md

---

## Story-5.2: 檔案瀏覽器 (待 Story-5.1 完成)

### Item 1: 檔案瀏覽器 HTML (P1)
- [ ] 新增 Files 頁面結構到 index.html
- [ ] 路徑輸入區 + Load/Refresh 按鈕
- [ ] 左側檔案樹面板 + 右側預覽面板
- [ ] 響應式 SplitView 佈局

### Item 2: 檔案瀏覽器 JS 模組 (P1)
- [ ] 實作 initFilesPage()
- [ ] 實作 loadFileTree() - 載入檔案樹
- [ ] 實作 renderTreeNode() - 遞迴渲染節點
- [ ] 實作 toggleFolder() - 展開/收合
- [ ] 實作 previewFile() - 預覽檔案內容
- [ ] 實作 getFileIcon() - 檔案類型 icon

### Item 3: 後端 API 實作 (P1)
- [ ] 實作 getFileTree() in fileService.ts
- [ ] 實作 readFileContent() in fileService.ts
- [ ] 實作 filterIgnoredFiles() - 過濾 .git, node_modules
- [ ] 大檔案截斷處理

### Story-5.2 完成
- [ ] GEMS Gate 通過
- [ ] 產出 Fillback_Story-5.2.md

---

## Story-5.3: 門控結果面板 (待 Story-5.2 完成)

### Item 1: Reports 頁面 HTML (P1)
- [ ] 新增 Reports 頁面結構到 index.html
- [ ] GEMS Gate + Test Gate 摘要卡片
- [ ] Priority 分佈條形圖區
- [ ] Issues 清單區 (Errors/Warnings 分頁)

### Item 2: Gate 結果 JS 模組 (P1)
- [ ] 實作 initReportsPage()
- [ ] 實作 loadGateResults() - 載入 Gate 結果
- [ ] 實作 renderGemsGate() - 渲染 GEMS Gate 卡片
- [ ] 實作 renderTestGate() - 渲染 Test Gate 卡片
- [ ] 實作 renderPriorityChart() - 渲染條形圖
- [ ] 實作 renderIssuesList() - 渲染問題清單
- [ ] 實作 switchIssueTab() - 切換分頁

### Item 3: 後端 Gate API (P1)
- [ ] 實作 getGateResults() in toolService.ts
- [ ] 整合 gems-scanner 輸出解析
- [ ] 整合 gems-test-gate 輸出解析
- [ ] 回傳 GateResult 格式

### Story-5.3 完成
- [ ] GEMS Gate 通過
- [ ] 產出 Fillback_Story-5.3.md

---

**執行規則**:
1. 每個 Story 按順序執行
2. 每完成一個 Item 更新 Fillback
3. Story 完成後執行 GEMS Gate
