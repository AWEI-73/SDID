# 📋 訓練流程監控系統 - 需求草稿

**草稿狀態**: [x] DONE

## 一句話目標
開發一個整合 Google Sheets 資料的 React 訓練流程監控儀表板，提供直觀的寬表視圖與逾期提醒功能。

## 用戶原始需求
目前的訓練計畫維護在一個龐大的「年度訓練計畫總表」Excel / Google Sheet 當中，資訊雖然齊全，但缺乏針對各自開班節點的橫向時間軸與視覺化提醒機制。辦訓人員需要一個「訓練流程監控系統」，能夠自動從總表中導入資料，並根據不同的基準日參數（如開訓前 N-75 天進行特定任務、N-14 天進行另一項任務），自動展開節點任務清單。然後，系統需將這些資料轉換為「寬表格」形式呈現日期，讓管理人員能一目了然地監控辦訓流程，同時提供提前提醒與通知，防止任務逾期。

---

## 1. 族群識別

| 族群 | 痛點 | 目標 |
|------|------|------|
| 辦訓人員 | 日常排程難以追蹤，容易遺漏準備節點 | 透過視覺化寬表監控各班期節點與逾期提醒 |
| 管理主管 | 無法快速掌握所有班期的準備進度 | 一眼看清本月/本日的所有關鍵任務狀態 |

---

## 2. 實體定義 (Entity Tables)

#### TrainingClass

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | string | UUID, PK |
| name | string | 班別名稱, VARCHAR(100) |
| code | string | 班別代號, VARCHAR(20) |
| year | number | 年度, INT |
| startDate | string | 開訓日期, DATE |
| endDate | string | 結訓日期, DATE |

#### TaskNode

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | string | UUID, PK |
| classId | string | 班級 FK, VARCHAR(36) |
| name | string | 任務名稱, VARCHAR(100) |
| dueDate | string | 預定完成日, DATE |
| status | TaskStatus | 狀態 ENUM('PENDING','DONE','OVERDUE') |
| alertDays | number | 提早提醒天數, INT |

---

## 3. 共用模組 (Shared)

- [x] shared

**樣式策略**: Tailwind CSS

---

## 4. 獨立模組 (Modules)

#### 模組：Dashboard (儀表板前端)
- 依賴: [shared]
- 公開 API:
  - renderWideTable(classes: TrainingClass[], tasks: TaskNode[]): void
  - renderAlerts(tasks: TaskNode[], today: string): AlertItem[]

- [x] 寬表格日/月監控視圖
- [x] 逾期提醒標示

#### 模組：GasApi (Google Apps Script 後端)
- 依賴: [shared]
- 公開 API:
  - parseSheet(sheetData: SheetRow[]): TrainingClass[]
  - publishEndpoint(req: GasRequest): GasResponse

- [x] 解析年度長表
- [x] 發佈 Web App API 端點

---

## 5. 路由結構

```
src/
├── shared/
│   ├── types/          → 共用型別 (TrainingClass, TaskNode, TaskStatus)
│   └── contracts/      → API 介面契約 (IGasApiService)
├── modules/
│   ├── dashboard/      → 儀表板前端 (WideTable, AlertBadge)
│   └── gas-api/        → GAS 後端 API (parseSheet, publishEndpoint)
├── routes/
│   └── AppRouter.tsx   → 前端主入口殼
└── index.ts            → 應用入口
```

---

## 📅 迭代規劃表

| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別 + 介面契約 + 前端殼 + 樣式 | shared | INFRA | 無 | [CURRENT] |
| 2 | Core MVP | 寬表 Mock 介面 + 逾期提醒 | Dashboard | FULL | shared | [STUB] |
| 3 | Backend | GAS API 解析 + 端點發佈 + 前端串接 | GasApi | FULL | shared, Dashboard | [STUB] |

---

## 📋 模組動作清單

### Iter 1: shared [CURRENT]

| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 | 依賴 | 狀態 | 操作 | AC |
|---------|------|---------|--------|------|------|------|------|----|
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE→FREEZE→EXPORT | 無 | ○○ | NEW | AC-0.0 |
| API 介面契約 | CONST | IGasApiService | P0 | DEFINE→FREEZE→EXPORT | [Internal.CoreTypes] | ○○ | NEW | AC-0.1 |
| 前端主入口殼 | ROUTE | AppRouter | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [Internal.CoreTypes] | ○○ | NEW | AC-0.2 |
| Tailwind 配置 | SCRIPT | TailwindConfig | P1 | INIT→CONFIGURE→EXPORT | 無 | ○○ | NEW | AC-0.3 |

### Iter 2: Dashboard [STUB]

> 寬表格儀表板前端，依賴 shared
> Story 拆法: Story-0 寬表元件 (UI), Story-1 逾期提醒 (UI/HOOK)

**函式 Flow 清單** (expand 時直接搬運):

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | AC |
|---------|------|---------|---|------|------|----|
| 寬表格元件 | UI | WideTable | P0 | RECEIVE_PROPS→COMPUTE_COLUMNS→RENDER_ROWS→BIND_EVENTS | [Internal.CoreTypes] | AC-1.0 |
| 逾期提醒標示 | UI | AlertBadge | P1 | CHECK_DUE_DATE→COMPARE_TODAY→COMPUTE_STATUS→RENDER_BADGE | [Internal.CoreTypes] | AC-1.1 |
| 儀表板頁路由 | ROUTE | DashboardPage | P1 | CHECK_AUTH→LOAD_DATA→RENDER_LAYOUT→RENDER_CONTENT | [Internal.WideTable, Internal.AlertBadge] | AC-1.2 |
| 資料狀態 Hook | HOOK | useTrainingData | P1 | INIT_STATE→FETCH_MOCK→TRANSFORM→SET_STATE | [Internal.CoreTypes] | AC-1.3 |

**驗收條件骨架**:

**AC-1.0** — 寬表格元件
- Given: 傳入 3 筆 TrainingClass + 各自的 TaskNode 清單
- When: 渲染 <WideTable classes={...} tasks={...} />
- Then: 顯示橫向時間軸，每班期一列，每任務節點一欄，日期正確對齊

**AC-1.1** — 逾期提醒標示
- Given: 今日為 2026-03-05，某任務 dueDate 為 2026-03-01
- When: 渲染 <AlertBadge task={...} today="2026-03-05" />
- Then: 顯示紅色 OVERDUE 標示

**AC-1.2** — 儀表板頁路由
- Given: npm run dev 啟動
- When: 瀏覽 /dashboard
- Then: 顯示寬表格 + 提醒標示，無 console error

**AC-1.3** — 資料狀態 Hook
- Given: Mock 資料已定義
- When: useTrainingData() 被呼叫
- Then: 回傳 { classes, tasks, loading: false }

### Iter 3: GasApi [STUB]

> Google Apps Script 後端 API，依賴 shared + Dashboard
> Story 拆法: Story-0 GAS 解析服務 (SVC), Story-1 前端串接 (HOOK/UI)

**函式 Flow 清單** (expand 時直接搬運):

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | AC |
|---------|------|---------|---|------|------|----|
| 解析年度長表 | SVC | parseSheet | P0 | READ_SHEET→VALIDATE_ROWS→TRANSFORM_TO_CLASS→EXPAND_TASKS→RETURN | [Internal.CoreTypes] | AC-2.0 |
| 發佈 API 端點 | API | publishEndpoint | P0 | RECEIVE_REQUEST→ROUTE→CALL_SERVICE→FORMAT_RESPONSE→RETURN | [Internal.parseSheet] | AC-2.1 |
| 真實資料 Hook | HOOK | useRealTrainingData | P1 | INIT_STATE→FETCH_GAS_API→TRANSFORM→SET_STATE | [Internal.CoreTypes] | AC-2.2 |

**驗收條件骨架**:

**AC-2.0** — 解析年度長表
- Given: Google Sheet 有 5 筆班期資料，每筆含開訓日期
- When: parseSheet(sheetRows)
- Then: 回傳 5 個 TrainingClass，每個含展開後的 TaskNode 清單（依 N-75/N-14 等基準日計算）

**AC-2.1** — 發佈 API 端點
- Given: GAS Web App 已部署
- When: GET /exec?action=getClasses
- Then: 回傳 JSON，status 200，含 TrainingClass 陣列

**AC-2.2** — 真實資料 Hook
- Given: GAS API 端點可用
- When: useRealTrainingData() 被呼叫
- Then: 回傳真實班期資料，WideTable 顯示真實內容

---

## ✅ 驗收條件

### Iter 1: shared

**AC-0.0** — 核心型別定義
- Given: 專案初始化完成
- When: import { TrainingClass, TaskNode, TaskStatus } from 'shared/types'
- Then: TypeScript 編譯通過，TrainingClass 含 id/name/code/year/startDate/endDate

**AC-0.1** — API 介面契約
- Given: IGasApiService 已定義
- When: 實作類別 implements IGasApiService
- Then: TypeScript 強制要求實作 parseSheet + publishEndpoint

**AC-0.2** — 前端主入口殼
- Given: npm run dev 啟動
- When: 瀏覽器開啟 localhost
- Then: 首頁框架可見（Header + 導覽列 + 主內容區），無 console error

**AC-0.3** — Tailwind 配置
- Given: tailwind.config.js 存在
- When: 在元件使用 Tailwind class
- Then: 樣式正確套用，無 PostCSS 錯誤
