# Requirement Specification - iter-5

**迭代**: iter-5  
**日期**: 2025-12-11  
**目標**: Control Tower UI 強化

> 📋 **放置位置**: `iterations/iter-5/requirement_spec_iter-5.md`

---

## 1. 迭代目標

**一句話目標**: 補齊前端 UI，讓所有後端工具都有對應的視覺化操作介面

**範圍**:
- ✅ 包含: UI 架構強化、工具操作面板、檔案瀏覽器、門控結果面板
- ❌ 不包含: 新後端工具開發、多專案管理

---

## 2. 用戶故事

### US-5.1: 工具操作
**As a** 開發者  
**I want** 在 UI 上直接操作 init-project、scaffold-files 等工具  
**So that** 不需要手動執行 CLI 命令

### US-5.2: 檔案瀏覽
**As a** 開發者  
**I want** 在 UI 上瀏覽專案檔案結構  
**So that** 可以快速確認哪些檔案已產生、哪些缺失

### US-5.3: 門控監控
**As a** 開發者  
**I want** 在 UI 上查看 GEMS Gate 和 Test Gate 結果  
**So that** 可以即時了解專案健康狀態

### US-5.4: 步驟詳情
**As a** 開發者  
**I want** 點擊節點時看到詳細的步驟狀態  
**So that** 知道目前進度和下一步

---

## 3. Stories 規劃

| Story | 名稱 | Type | Priority | 說明 |
|-------|------|------|:--------:|------|
| Story-5.0 | UI 基礎架構 | INFRASTRUCTURE | P0 | 側邊欄、頁籤、模組化 JS |
| Story-5.1 | 工具操作面板 | FEATURE | P0 | init-project, scaffold-files 介面 |
| Story-5.2 | 檔案瀏覽器 | FEATURE | P1 | 樹狀結構顯示 |
| Story-5.3 | 門控結果面板 | FEATURE | P1 | GEMS Gate + Test Gate 視覺化 |

---

## 4. 技術規格

### 4.1 前端技術棧
- **HTML5** + **Tailwind CSS** (CDN)
- **Vanilla JavaScript** (模組化)
- **無框架** - 保持簡單

### 4.2 API 整合
使用現有 Express 後端 API：
- `POST /api/scan` - 掃描專案
- `POST /api/prompt` - 產生 Prompt
- 新增 API:
  - `POST /api/tools/init-project` - 初始化專案
  - `POST /api/tools/scaffold` - 產生骨架
  - `GET /api/files` - 取得檔案清單
  - `GET /api/gate` - 取得門控結果

### 4.3 UI 結構

```
┌─────────────────────────────────────────────────────┐
│  🚀 GEMS Control Tower              [專案路徑 ▼]    │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  Main Content Area                       │
│──────────│──────────────────────────────────────────│
│ 📊 Dashboard │  ┌─ POC ─┐─┌─ PLAN ─┐─┌─ BUILD ─┐─┌─ SCAN ─┐
│ 🛠 Tools     │  │  ✅   │→│  ✅    │→│   ⏳   │→│  ⏸    │
│ 📁 Files     │  └───────┘ └────────┘ └─────────┘ └────────┘
│ 📊 Reports   │                                          │
│              │  [Details Panel]                         │
└──────────────┴──────────────────────────────────────────┘
```

---

## 5. 驗收標準

### AC-5.0: UI 基礎架構
- [ ] 側邊欄可切換 4 個頁面（Dashboard / Tools / Files / Reports）
- [ ] 頁籤切換平滑，無頁面刷新
- [ ] JS 模組化（app.js 拆分為多個模組）
- [ ] Toast 通知系統運作正常

### AC-5.1: 工具操作面板
- [ ] 可輸入路徑執行 init-project
- [ ] 可選擇 plan 執行 scaffold-files
- [ ] 執行結果顯示在 UI
- [ ] 錯誤訊息顯示在 UI

### AC-5.2: 檔案瀏覽器
- [ ] 樹狀結構顯示專案目錄
- [ ] 可展開/收合資料夾
- [ ] 顯示檔案類型 icon
- [ ] 點擊檔案可預覽內容

### AC-5.3: 門控結果面板
- [ ] 顯示 GEMS Gate 結果（通過/失敗）
- [ ] 顯示函式統計（P0/P1/P2/P3）
- [ ] 顯示 Test Gate 結果
- [ ] 顯示警告/錯誤清單

---

## 6. 依賴關係

| 依賴 | 類型 | 說明 |
|------|------|------|
| Express Server | internal | 現有後端 API |
| Tailwind CSS | external | CDN 引入 |
| 後端工具 | internal | init-project.cjs, scaffold-files.cjs 等 |

---

## 7. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| JS 過於複雜 | Medium | 模組化拆分，保持簡單 |
| API 回應慢 | Low | Loading 狀態指示 |
| 瀏覽器相容 | Low | 只支援現代瀏覽器 |

---

**產出日期**: 2025-12-11 | **Agent**: PLAN
