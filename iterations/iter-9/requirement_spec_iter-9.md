# Requirement Spec: System Blueprint Visualizer (iter-9)

**迭代**: iter-9  
**Story ID**: Story-Viz.1  
**日期**: 2025-12-18  
**狀態**: ✅ POC 完成

---

## 1. 用戶故事 (User Story)

**作為**架構師與開發人員，  
**我想要**一個能穿透專案層級（Project -> Module -> Script -> Function）的可視化儀表板，  
**以便**像查看設備藍圖一樣，深入了解系統結構、配置與核心業務流程，而不必在程式碼中迷路。

---

## 2. 核心功能與資料契約

### 2.1 層級結構 (Hierarchy)

系統將展示以下四層結構：
1.  **Project (專案層)**: 全域配置 (Config)、硬編碼警告 (Hardcoded)、統計數據。
2.  **Module (模組層)**: 業務功能分組，顯示包含的腳本數量與依賴。
3.  **Script (腳本層)**: 實體檔案 (e.g., Service, Controller)，是業務邏輯的載體。
4.  **Function (功能層)**: 具體的函式或 API 入口，如果是 P0 則顯示詳細流程 (Flow)。

### 2.2 資料契約 (Data Contract)

參見 `SpecVisualizerPOC.html` 中的 `@GEMS-CONTRACT`。核心資料結構如下：

```typescript
// @GEMS-CONTRACT: SystemNode
// 遞迴結構，支援 Project / Module / Script / Function 各種層級
interface SystemNode {
  name: string;        // 節點名稱
  type: 'project' | 'module' | 'script' | 'function' | 'config-group';
  desc?: string;       // 描述
  path?: string;       // 檔案路徑 (Script/Function 層級)
  stats?: SystemStats; // 統計資料 (Project 層級)
  config?: ConfigData; // 全域設定 (Project 層級)
  functions?: FunctionNode[]; // 包含的功能 (Script 層級)
  children?: SystemNode[]; // 子節點 (Project/Module 層級)
}

interface FunctionNode {
  name: string;
  tag?: 'P0' | 'P1' | 'API'; // GEMS 標籤
  flow?: string[];     // 執行流程步驟 (Step1 -> Step2)
}
```

---

## 3. 驗收標準 (Acceptance Criteria)

### AC-1: 層級導航 (Tree Navigation)
**Given** 使用者進入 Blueprint 頁面  
**Then** 左側顯示 Project -> Module -> Script 的樹狀結構  
**And** 點擊任一層級，右側顯示對應的詳細視圖

### AC-2: 專案總覽 (Project Dashboard)
**Given** 點擊根節點 (Project)  
**Then** 右側顯示全域統計數據 (Modules, Scripts)  
**And** 顯示 `config.json` 解析出的全域變數與 Hardcoded Values 警告

### AC-3: 腳本細節 (Script Details)
**Given** 點擊某個 Script 節點 (e.g., `inventory.service.ts`)  
**Then** 右側列出該檔案內的所有 Functions  
**And** 若 Function 為 P0/P1，顯示其 Flow Steps 流程圖

### AC-4: 資料整合 (Data Integration)
**Then** 系統必須能正確整合 `structure.json` (結構)、`config.json` (配置) 與 `Full_Project_Spec.md` (流程) 的資料內容。

---

## 4. UI 設計規範

- **佈局**: 兩欄式 (Left: Tree, Right: Detail)
- **視覺風格**: 簡潔、專業、類似 IDE 或工程圖紙
- **互動**:
    - Tree Node 點擊高亮
    - Script Card 清楚展示 Path 與 Module 歸屬
    - Flow Steps 使用箭頭串接 (A → B → C)

---

## 5. 獨立可測性 (Independent Testability)

本 POC 僅驗證 **前端可視化邏輯與互動體驗**。
所有資料來源使用 `SYSTEM_DATA` 模擬物件，不依賴後端真實讀取檔案。

---

## 6. POC 檔案位置

- `iterations/iter-9/poc/SpecVisualizerPOC.html`

---

## 7. 未來擴充規劃 (Roadmap)

1.  **資料庫結構 (DB Schema)**:
    - 預計在左側樹狀結構增加 `Database` 節點。
    - 需擴充 Scanner 解析 `DATABASE_SCHEMA.md` 或 TypeORM Entity。
2.  **API 依賴圖 (API Dependency)**:
    - 可視化各個 Endpoint 之間的呼叫關係。

---

**文檔版本**: v1.2  
**日期**: 2025-12-18  
**狀態**: ✅ 最終確認
