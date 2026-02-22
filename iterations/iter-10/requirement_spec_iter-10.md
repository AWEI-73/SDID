# Requirement Spec: GEMS Spec Visualizer V5

## 1. 用戶故事
作為開發者和專案管理者，我想要一個「全自動生成」且「高度視覺化」的專案規格書 (Spec Visualizer)，以便於無需手動維護文件即可掌握專案全貌 (Architecture, Modules, Data)。

視覺風格需達到 "DeepWiki" 或技術白皮書等級的極簡與高資訊密度，並包含自動繪製的架構圖。

## 2. 資料契約 (Source of Truth)
本專案為純前端視覺化工具，其資料來源為 **GEMS Scanner** 的產出結果。
契約定義如下：

- **Structure Data**: `structure.json` (File Tree & Stats)
- **Scan Data**: `Full_Project_Spec.json` (Module & GEMS Tags)
- **Tech Stack**: `package.json` + `Dictionary Map`
- **Schema Data**: `schema.json` (Parses `DATABASE_SCHEMA.md`)

## 3. 驗收標準 (Acceptance Criteria)

### AC-1: 全自動技術棧掃描 (Automated Tech Stack)
Given 專案根目錄有 `package.json`
When 執行 `run-all-scanners.cjs`
Then 規格書的 "Overview" 區塊應自動列出核心技術 (Next.js, TypeScript 等)
And 每個技術應附帶白話文說明 (來自字典檔)

### AC-2: 現代化架構圖 (Modern Architecture SVG)
Given 掃描器執行完畢
When 打開 `Full_Project_Spec.html`
Then "System Architecture" 區塊應顯示一張 SVG 架構圖
And 該圖應具備 Eraser.io 風格 (圓角、陰影、深色背景)
And 該圖應為程式碼動態生成，非靜態圖片檔

### AC-3: 邏輯動線視覺化 (Logic Flow Visualization)
Given 代碼中有 `// [STEP]` 標籤
When 瀏覽 "Modules" 區塊
Then 每個 Function 下方應顯示 `FLOW: Step A -> Step B -> Step C` 的箭頭流程條
And 該流程條應自動從 `GEMS-FLOW` 標籤中提取

### AC-4: V5 極簡風格 (DeepWiki Style)
Given 規格書已生成
When 使用者閱讀文件
Then 介面應為單欄式文檔佈局 (Single Column)
And 不應出現 Dashboard Cards 或過度裝飾的特效
And 所有技術名詞應盡量使用「人話」解釋

## 4. POC 檔案
- [GEMS_Spec_Visualizer_V5.html](file:///c:/Users/user/Desktop/gems-flow-test/control-tower/iterations/iter-10/poc/GEMS_Spec_Visualizer_V5.html)
- [Full_Project_Spec.html (Generated)](file:///c:/Users/user/Desktop/gems-flow-test/control-tower/.gems/docs/Full_Project_Spec.html)
