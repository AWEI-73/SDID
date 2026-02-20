# 📦 任務管理系統 - 需求規格書

**版本**: v1.0  
**日期**: 2026-01-13  
**Level**: M  
**一句話願景**: 讓個人開發者能快速追蹤每日任務進度，提升工作效率並減少遺漏

> Status: READY FOR PLAN

---

## ⚠️ 黃金範例說明

**此檔案是 requirement_spec 的完整範例**，展示了：
- ✅ 具體的角色描述（非佔位符）
- ✅ 完整的功能說明（有細節）
- ✅ 詳盡的 BDD 驗收標準（多場景）
- ✅ 清楚的 DEFERRED 項目聲明

**請以此為標準產出您的 requirement_spec**。

---

## 0. 範疇聲明 (Scope Declaration)

### 已驗證功能 (POC Verified)
- 任務列表渲染與展示
- 新增任務（含輸入驗證）
- 切換任務完成狀態
- 刪除任務
- 任務統計計數顯示
- LocalStorage 資料持久化

### 延期功能 (DEFERRED to iter-2)
- 任務編輯（修改標題）
- 拖拉排序
- 批次刪除已完成任務
- 任務分類/標籤系統
- 到期日提醒

---

## 1. 用戶故事

### Story 1.0: 基礎建設 [已驗證]

作為 軟體開發團隊成員，我想要 建立任務管理系統的基礎架構（包含資料型別定義、LocalStorage 存取工具、基礎配置），以便於 後續功能開發有穩定的技術基礎和統一的程式碼風格。

> 驗證狀態: [已驗證] - POC 已完成 saveData/loadData 實作

**功能細節**:
- `Task` 型別定義：包含 id (UUID)、title (字串)、completed (布林)、createdAt (ISO 時間戳)
- `saveData()` 函式：將任務陣列序列化並儲存至 LocalStorage
- `loadData()` 函式：從 LocalStorage 讀取並反序列化任務資料，含資料驗證
- 專案目錄結構：遵循 GEMS 分層架構 (config, assets, lib, shared, modules, routes)

**技術決策**:
- 使用 `crypto.randomUUID()` 產生任務 ID（瀏覽器原生支援）
- LocalStorage key 統一使用 `gems_` 前綴避免命名衝突
- 資料讀取失敗時回退到空陣列（而非報錯）


### Story 1.1: 任務 CRUD [已驗證]

作為 個人開發者，我想要 能夠新增、查看、刪除任務，以便於 快速記錄並管理我的待辦事項。

> 驗證狀態: [已驗證] - POC 已實作 addTask, render, deleteTask

**功能細節**:
- **新增任務 (Create)**: 輸入任務標題，點擊按鈕或按 Enter 新增
  - 輸入驗證：不可為空、不可超過 100 字、不可重複
  - 新任務自動加入列表最上方
- **顯示任務 (Read)**: 渲染任務列表，顯示標題、建立日期、完成狀態
  - 空狀態時顯示友善提示
  - hover 時顯示刪除按鈕
- **刪除任務 (Delete)**: 點擊刪除按鈕移除任務
  - 無確認對話框（POC 簡化版）


### Story 1.2: 狀態切換 [已驗證]

作為 個人開發者，我想要 能夠標記任務為已完成或未完成，以便於 追蹤我的工作進度。

> 驗證狀態: [已驗證] - POC 已實作 toggleTask

**功能細節**:
- 點擊任務前的勾選框切換狀態
- 已完成任務：標題加上刪除線、文字變灰、勾選框顯示打勾
- 狀態變更後自動更新統計數據


### Story 1.3: 統計儀表板 [已驗證]

作為 個人開發者，我想要 看到任務的統計數據，以便於 了解整體工作進度。

> 驗證狀態: [已驗證] - POC 已實作 updateStats

**功能細節**:
- 顯示三個統計卡片：全部任務、已完成、進行中
- 任何任務變動（新增/刪除/切換狀態）後自動更新數據

---

## 2. 資料契約

### @GEMS-CONTRACT: Task

**核心資料實體**: TaskContract.ts

| 欄位名稱 | 型別 | 資料庫 | 約束 | 說明 |
|---------|------|--------|------|------|
| id | string | VARCHAR(36) | PK, NOT NULL | UUID 格式唯一識別碼 |
| title | string | VARCHAR(100) | NOT NULL | 任務標題，1-100 字 |
| completed | boolean | BOOLEAN | DEFAULT false | 完成狀態 |
| createdAt | string | TIMESTAMP | DEFAULT NOW() | ISO 8601 格式建立時間 |

**範例資料**:
```json
{
  "id": "task-1705123456789-abc123def",
  "title": "完成 GEMS 需求規格書",
  "completed": false,
  "createdAt": "2026-01-13T10:30:00.000Z"
}
```

**邊界條件**:
- 單一使用者最多 1000 筆任務（LocalStorage 容量限制）
- title 不可為空白字串或純空格
- id 必須唯一，建議使用 timestamp + 隨機字串組合

---

## 3. 驗收標準 (BDD 格式)

### AC-1.0: 基礎建設

**獨立可測性**: 可獨立執行單元測試，不依賴 DOM

```gherkin
Feature: 資料持久化

Scenario: 成功儲存任務資料
  Given 記憶體中有 3 筆任務資料
  When 呼叫 saveData() 函式
  Then LocalStorage 應包含 key "gems_tasks"
  And 該 key 的值應為有效 JSON 陣列
  And 陣列長度應為 3

Scenario: 成功載入任務資料
  Given LocalStorage 中存有 2 筆任務的 JSON
  When 呼叫 loadData() 函式
  Then 應返回長度為 2 的任務陣列
  And 每筆任務應包含 id, title, completed, createdAt 欄位

Scenario: 載入損壞資料時回退
  Given LocalStorage 中存有無效 JSON 字串
  When 呼叫 loadData() 函式
  Then 應返回 null（表示使用預設值）
  And 控制台應輸出錯誤訊息
```


### AC-1.1: 任務 CRUD

**獨立可測性**: 可獨立渲染 TaskInput 和 TaskList 元件進行測試

```gherkin
Feature: 新增任務

Scenario: 成功新增任務
  Given 任務輸入框為空
  And 目前有 2 筆任務
  When 使用者輸入「撰寫單元測試」
  And 點擊新增按鈕
  Then 任務列表應顯示 3 筆任務
  And 第一筆任務標題應為「撰寫單元測試」
  And 該任務狀態應為「未完成」
  And 輸入框應被清空

Scenario: 空白輸入被阻擋
  Given 任務輸入框為空
  When 使用者直接點擊新增按鈕
  Then 應顯示錯誤訊息「任務名稱不可為空」
  And 任務數量應維持不變

Scenario: 超長輸入被阻擋
  Given 任務輸入框為空
  When 使用者輸入超過 100 字的文字
  And 點擊新增按鈕
  Then 應顯示錯誤訊息「任務名稱不可超過 100 字」

Scenario: 重複任務被阻擋
  Given 已存在任務「寫程式」
  When 使用者輸入「寫程式」並新增
  Then 應顯示錯誤訊息「已存在相同名稱的任務」
```

```gherkin
Feature: 刪除任務

Scenario: 成功刪除任務
  Given 存在 ID 為 "task-001" 的任務
  When 使用者點擊該任務的刪除按鈕
  Then 任務列表不應包含 ID "task-001"
  And 統計數據應減少 1
```


### AC-1.2: 狀態切換

**獨立可測性**: 可獨立測試 toggleTask 函式與 UI 狀態

```gherkin
Feature: 切換完成狀態

Scenario: 標記任務為已完成
  Given 存在未完成的任務「寫程式」
  When 使用者點擊該任務的勾選框
  Then 該任務狀態應變為「已完成」
  And 任務標題應顯示刪除線
  And 「已完成」計數應增加 1
  And 「進行中」計數應減少 1

Scenario: 取消任務完成狀態
  Given 存在已完成的任務「寫程式」
  When 使用者點擊該任務的勾選框
  Then 該任務狀態應變為「未完成」
  And 任務標題不應有刪除線
```


### AC-1.3: 統計儀表板

**獨立可測性**: 可注入任意任務資料測試統計計算

```gherkin
Feature: 統計數據更新

Scenario: 顯示正確統計
  Given 存在 5 筆任務，其中 2 筆已完成
  When 畫面載入完成
  Then 「全部任務」應顯示 5
  And 「已完成」應顯示 2
  And 「進行中」應顯示 3

Scenario: 新增後統計更新
  Given 存在 3 筆任務
  When 使用者新增 1 筆任務
  Then 「全部任務」應更新為 4
```

---

## 4. 獨立可測性

- ✅ **驗證**: saveData, loadData, addTask, toggleTask, deleteTask, updateStats, render
- ❌ **不驗證**: 複雜動畫效果、跨瀏覽器相容性、效能最佳化
- 🔄 **DEFERRED**: 任務編輯、拖拉排序、批次刪除、到期提醒

---

## 5. Story 拆分建議

| Story | 名稱 | 優先級 | 依賴 | 驗證狀態 | 預估複雜度 |
|-------|------|--------|------|----------|-----------|
| 1.0 | 基礎建設 | P0 | 無 | [已驗證] | 低 |
| 1.1 | 任務 CRUD | P0 | Story 1.0 | [已驗證] | 中 |
| 1.2 | 狀態切換 | P0 | Story 1.0 | [已驗證] | 低 |
| 1.3 | 統計儀表板 | P1 | Story 1.1, 1.2 | [已驗證] | 低 |

**建議實作順序**: 1.0 → 1.1 → 1.2 → 1.3

---

## 6. 可行性評估 (Level M)

### 技術風險評估

| 風險項目 | 風險等級 | 緩解措施 |
|---------|---------|---------|
| LocalStorage 容量限制 | 低 | 設定 1000 筆上限，超過時警告使用者 |
| 資料損壞 | 低 | loadData 含錯誤處理，回退到空陣列 |
| UUID 碰撞 | 極低 | 使用 timestamp + 隨機字串組合 |

### 已驗證項目

✅ 所有核心功能已在 POC 驗證，技術可行性已確認：
- UI 渲染與互動正常
- LocalStorage 讀寫穩定
- 輸入驗證邏輯完整

### 待解決事項

無重大阻塞項目，可直接進入開發階段。

---

## 7. 附錄

### 參考檔案
- POC 原型: `.gems/iterations/iter-1/poc/TaskManagerPOC.html`
- 資料契約: `.gems/iterations/iter-1/poc/TaskContract.ts`

### 術語表
| 術語 | 定義 |
|------|------|
| Task | 單一待辦任務項目 |
| CRUD | Create, Read, Update, Delete 四種基本操作 |
| BDD | Behavior-Driven Development 行為驅動開發 |

---

**文件版本**: v1.0 | **產出日期**: 2026-01-13 | **作者**: GEMS Architect
