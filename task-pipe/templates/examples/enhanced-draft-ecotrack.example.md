# 📋 EcoTrack 碳盤查系統 - 活藍圖 (Living Blueprint)

**迭代**: iter-1
**日期**: 2026-02-08
**草稿狀態**: [x] DONE
**規模**: M
**方法論**: SDID v2.1

---

## 用戶原始需求

> EcoTrack 提供一個直覺化的數據填報與自動生成報告系統，降低中小企業 ESG 碳盤查合規門檻。
> 目標客群為製造業供應鏈中的中小企業及需要建立永續報告書的上市公司。
> 技術架構：React 前端、Node.js (Express) 後端、PostgreSQL 資料庫。

---

## 一句話目標

讓中小企業能透過引導式填報快速完成碳盤查，並一鍵生成合規 PDF 報告。

---

## 🏗️ 模組化設計藍圖

### 1. 族群識別

| 族群名稱 | 描述 | 特殊需求 |
|---------|------|---------|
| 填報員 | 負責輸入電力、燃油、水耗等數據 | 引導式表單、資料暫存 |
| 管理者 | 審核數據、生成報告 | 看板總覽、報告匯出 |
| 系統管理員 | 管理排放係數庫、組織設定 | 係數 CRUD、權限管理 |

### 2. 實體定義 (Entity Tables)

#### Organization
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| name | string | NOT NULL, VARCHAR(200) | 組織名稱 |
| industry | string | NOT NULL | 產業類別 |
| reportYear | number | NOT NULL | 盤查年度 |

#### EmissionRecord
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| orgId | string | FK → Organization.id | 所屬組織 |
| scope | enum | 'SCOPE1'\|'SCOPE2'\|'SCOPE3' | 排放範疇 |
| category | string | NOT NULL | 排放類別 (電力/燃油/水耗) |
| amount | number | NOT NULL, >= 0 | 活動數據量 |
| unit | string | NOT NULL | 單位 (kWh/L/m³) |
| factorId | string | FK → EmissionFactor.id | 使用的排放係數 |
| co2e | number | COMPUTED | 二氧化碳當量 (自動計算) |
| period | string | NOT NULL | 填報期間 (YYYY-MM) |

#### EmissionFactor
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| name | string | NOT NULL | 係數名稱 |
| category | string | NOT NULL | 類別 |
| value | number | NOT NULL | 係數值 |
| unit | string | NOT NULL | 單位 (kgCO2e/kWh) |
| source | string | NOT NULL | 來源 (環保署/GHG Protocol) |
| year | number | NOT NULL | 適用年度 |

### 3. 共用模組 (Shared)

- [x] 基礎建設 (types, config, constants)
- [x] API 介面契約 (IDataEntryService, IDashboardService interface)
- [x] 前端主入口殼 (AppRouter / Layout — npm run dev 可見首頁框架)
- [x] 儲存層封裝 (PostgreSQL CRUD)
- [ ] 通用 UI 元件 (表單、表格、通知)

**樣式策略**: CSS Modules (.module.css)

### 4. 獨立模組 (Modules)

#### 模組：data-entry (數據填報)
- 依賴: [shared/types, shared/storage]
- 公開 API (index.ts):
  - createRecord(data: RecordInput): Promise<EmissionRecord>
  - getRecords(orgId: string, period: string): Promise<EmissionRecord[]>
  - calcEmission(amount: number, factorId: string): number
- 獨立功能:
  - [x] ISO 14064-1 引導式填報表單
  - [x] 排放係數自動帶入
  - [x] CO2e 自動換算
  - [ ] 資料暫存與續填

#### 模組：dashboard (視覺化看板)
- 依賴: [shared/types, data-entry]
- 公開 API (index.ts):
  - getScopeSummary(orgId: string, year: number): Promise<ScopeSummary>
  - getTrendData(orgId: string, months: number): Promise<TrendPoint[]>
- 獨立功能:
  - [x] 碳排分佈圖 (範疇一、二、三)
  - [x] 年度趨勢圖
  - [ ] 同業比較

#### 模組：report-gen (報告生成)
- 依賴: [shared/types, data-entry, dashboard]
- 公開 API (index.ts):
  - generateReport(orgId: string, year: number): Promise<ReportPDF>
- 獨立功能:
  - [ ] 一鍵生成 PDF 碳盤查清冊
  - [ ] 符合 ISO 14064-1 格式

### 5. 路由結構

```
src/
├── config/            → 全域配置 (環境變數、常數)
├── lib/               → 第三方庫封裝 (DB Client)
├── shared/            → 跨模組共用
│   ├── types/         → 共用型別 (Organization, EmissionRecord, EmissionFactor)
│   ├── storage/       → 儲存層 (dbClient)
│   └── contracts/     → API 介面契約 (IDataEntryService, IDashboardService)
├── modules/           → 核心業務
│   ├── data-entry/    → 數據填報 (引導式表單、CO2e 計算)
│   ├── dashboard/     → 視覺化看板 (碳排分佈、趨勢圖)
│   └── report-gen/    → 報告生成 (PDF 碳盤查清冊)
├── routes/            → 路由定義
│   └── AppRouter.tsx
└── index.ts           → 應用入口
```

---

## 📅 迭代規劃表 (Iteration Planning)

| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別 + API 介面契約 + 前端殼 + 儲存層 | shared | INFRA | 無 | [CURRENT] |
| 2 | Core MVP | 引導式數據填報 + CO2e 計算 (後端→前端) | data-entry | FULL | shared | [STUB] |
| 3 | Visualization | 碳排看板 + 趨勢圖 (後端→前端) | dashboard | FULL | shared, data-entry | [STUB] |
| 4 | Report | PDF 報告生成 + 下載 UI | report-gen | FULL | shared, data-entry, dashboard | [STUB] |

---

## 📋 模組動作清單 (Module Actions)

### Iter 1: shared [CURRENT]

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 操作 | 狀態 | 演化 | AC |
|---------|------|---------|---|------|------|------|------|------|----|
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE→FREEZE→EXPORT | 無 | NEW | ○○ | BASE | AC-0.0 |
| 環境變數管理 | CONST | ENV_CONFIG | P2 | LOAD→VALIDATE→EXPORT | 無 | NEW | ○○ | BASE | - |
| API 介面契約 | CONST | IServiceContracts | P1 | DEFINE→VALIDATE→EXPORT | [Internal.CoreTypes] | NEW | ○○ | BASE | AC-0.1 |
| 資料庫連線 | LIB | dbClient | P0 | CONNECT→POOL→HEALTH_CHECK→EXPORT | [Internal.ENV_CONFIG] | NEW | ○○ | BASE | AC-0.2 |
| 排放係數 CRUD | SVC | factorService | P1 | VALIDATE→PERSIST→CACHE→RETURN | [Internal.CoreTypes, Internal.dbClient] | NEW | ○○ | BASE | AC-0.3 |
| 前端主入口殼 | ROUTE | AppRouter | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [Internal.CoreTypes] | NEW | ○○ | BASE | AC-0.4 |

### Iter 2: data-entry [STUB]

> 引導式數據填報 + CO2e 自動計算，依賴 shared
> Story 拆法: Story-0 後端計算層 (SVC/API), Story-1 填報 UI (UI/ROUTE)

**函式 Flow 清單** (expand 時直接搬運):

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | AC |
|---------|------|---------|---|------|------|----|
| CO2e 排放量計算 | SVC | calcEmission | P0 | VALIDATE_INPUT→LOOKUP_FACTOR→MULTIPLY→ROUND→RETURN | [shared/types, factorService] | AC-1.0 |
| 新增排放紀錄 | SVC | createRecord | P0 | VALIDATE→CALC_CO2E→PERSIST→RETURN | [Internal.calcEmission, dbClient] | AC-1.1 |
| 查詢排放紀錄 | SVC | getRecords | P1 | VALIDATE_PARAMS→QUERY→TRANSFORM→RETURN | [Internal.CoreTypes, dbClient] | AC-1.2 |
| 填報表單元件 | UI | DataEntryForm | P1 | LOAD_FACTORS→RENDER_FORM→VALIDATE_INPUT→SUBMIT | [Internal.createRecord, factorService] | AC-1.3 |
| 填報頁路由 | ROUTE | DataEntryPage | P1 | CHECK_AUTH→LOAD_DATA→RENDER_LAYOUT→RENDER_CONTENT | [Internal.DataEntryForm] | AC-1.4 |

**驗收條件骨架**:

**AC-1.0** — CO2e 計算正確性
DOMAIN: Clear | ERROR_RETURNS: ValidationError
- Happy Path:
  - Given: factorId='elec-tw-2024'，對應係數值 0.494 kgCO2e/kWh
  - When: calcEmission(1000, 'elec-tw-2024')
  - Then: 回傳 494（四捨五入到整數），單位 kgCO2e
- Edge:
  - Given: amount = 0
  - When: calcEmission(0, 'elec-tw-2024')
  - Then: 回傳 0，不拋錯
- Failure:
  - Given: factorId 不存在於係數庫
  - When: calcEmission(1000, 'non-existent-factor')
  - Then: throw ValidationError('排放係數不存在: non-existent-factor')

**AC-1.1** — 新增排放紀錄
DOMAIN: Complicated | ERROR_RETURNS: ValidationError | DbConnectionError
- Happy Path:
  - Given: dbClient 已連線，calcEmission 可用
  - When: createRecord({ orgId: 'org-001', scope: 'SCOPE2', category: '電力', amount: 1000, unit: 'kWh', factorId: 'elec-tw-2024', period: '2024-01' })
  - Then: 資料庫新增一筆紀錄，co2e 欄位自動填入 494，回傳含 id 的完整物件
- Edge:
  - Given: 同 orgId + period + factorId 的紀錄已存在
  - When: createRecord({ orgId: 'org-001', period: '2024-01', factorId: 'elec-tw-2024', ... })
  - Then: throw ValidationError('該期間已有相同係數的紀錄，請使用更新')
- Failure:
  - Given: dbClient 斷線
  - When: createRecord({ ... })
  - Then: throw DbConnectionError('資料庫寫入失敗，請稍後重試')

**AC-1.2** — 查詢排放紀錄
DOMAIN: Clear | ERROR_RETURNS: ValidationError
- Happy Path:
  - Given: 資料庫有 org-001 在 2024-01 的 3 筆紀錄
  - When: getRecords('org-001', '2024-01')
  - Then: 回傳長度 3 的陣列，每筆含 co2e 欄位，按 createdAt 升序排列
- Edge:
  - Given: 該 orgId + period 無任何紀錄
  - When: getRecords('org-001', '2099-12')
  - Then: 回傳空陣列 []，不拋錯
- Failure:
  - Given: orgId 為空字串
  - When: getRecords('', '2024-01')
  - Then: throw ValidationError('orgId 不可為空')

**AC-1.3** — 填報表單提交
DOMAIN: Complicated | ERROR_RETURNS: N/A
- Happy Path:
  - Given: 使用者在填報頁，係數清單已載入（至少 1 筆）
  - When: 選擇類別「電力」，輸入 1000 kWh，點擊提交
  - Then: 呼叫 createRecord，成功後顯示「新增成功」提示，表單清空
- Edge:
  - Given: 係數清單為空（factorService 回傳 []）
  - When: 渲染 DataEntryForm
  - Then: 顯示「目前無可用排放係數」提示，提交按鈕 disabled
- Failure:
  - Given: createRecord 拋出 ValidationError
  - When: 使用者點擊提交
  - Then: 顯示錯誤訊息於表單頂部，表單資料保留不清空

**AC-1.4** — 填報頁路由
DOMAIN: Clear | ERROR_RETURNS: N/A
- Happy Path:
  - Given: 已登入使用者
  - When: 瀏覽 /data-entry
  - Then: 顯示填報表單，係數下拉選單有資料，無 console error
- Edge:
  - Given: 使用者未登入
  - When: 直接瀏覽 /data-entry
  - Then: 重導向至 /login，不顯示表單
- Failure:
  - Given: factorService 載入失敗（網路錯誤）
  - When: 頁面初始化
  - Then: 顯示「資料載入失敗，請重新整理」，不白屏

### Iter 3: dashboard [STUB]

> 碳排分佈圖 + 年度趨勢圖，依賴 shared + data-entry
> Story 拆法: Story-0 統計計算層 (SVC), Story-1 圖表 UI (UI/ROUTE)

**函式 Flow 清單** (expand 時直接搬運):

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | AC |
|---------|------|---------|---|------|------|----|
| 範疇分佈統計 | SVC | getScopeSummary | P0 | QUERY_RECORDS→GROUP_BY_SCOPE→SUM_CO2E→RETURN | [getRecords, CoreTypes] | AC-2.0 |
| 月度趨勢計算 | SVC | getTrendData | P1 | QUERY_RANGE→AGGREGATE_BY_MONTH→SORT→RETURN | [getRecords] | AC-2.1 |
| 碳排看板元件 | UI | DashboardView | P1 | FETCH_SUMMARY→FETCH_TREND→RENDER_CHARTS→BIND_FILTER | [getScopeSummary, getTrendData] | AC-2.2 |
| 看板頁路由 | ROUTE | DashboardPage | P1 | CHECK_AUTH→LOAD_ORG→RENDER_LAYOUT→RENDER_CONTENT | [Internal.DashboardView] | AC-2.3 |

**驗收條件骨架**:

**AC-2.0** — 範疇分佈統計
DOMAIN: Clear | ERROR_RETURNS: ValidationError
- Happy Path:
  - Given: org-001 在 2024 年有 SCOPE1: 200 kgCO2e, SCOPE2: 800 kgCO2e
  - When: getScopeSummary('org-001', 2024)
  - Then: 回傳 { SCOPE1: 200, SCOPE2: 800, SCOPE3: 0, total: 1000 }
- Edge:
  - Given: org-001 在 2024 年無任何排放紀錄
  - When: getScopeSummary('org-001', 2024)
  - Then: 回傳 { SCOPE1: 0, SCOPE2: 0, SCOPE3: 0, total: 0 }，不拋錯
- Failure:
  - Given: year 為非正整數（如 -1 或 0）
  - When: getScopeSummary('org-001', -1)
  - Then: throw ValidationError('year 必須為正整數')

**AC-2.1** — 月度趨勢
DOMAIN: Clear | ERROR_RETURNS: ValidationError
- Happy Path:
  - Given: org-001 在 2024-01 到 2024-03 各有排放紀錄
  - When: getTrendData('org-001', 3)
  - Then: 回傳長度 3 的陣列，按月份升序排列，每筆含 month + totalCo2e
- Edge:
  - Given: months = 1
  - When: getTrendData('org-001', 1)
  - Then: 回傳長度 1 的陣列，只含最近一個月資料
- Failure:
  - Given: months <= 0
  - When: getTrendData('org-001', 0)
  - Then: throw ValidationError('months 必須大於 0')

**AC-2.2** — 看板元件渲染
DOMAIN: Complicated | ERROR_RETURNS: N/A
- Happy Path:
  - Given: getScopeSummary 回傳有效資料（total > 0）
  - When: 渲染 <DashboardView orgId="org-001" year={2024} />
  - Then: 顯示圓餅圖（3 個範疇）+ 折線圖（月度趨勢），無 console error
- Edge:
  - Given: getScopeSummary 回傳 total = 0
  - When: 渲染元件
  - Then: 顯示「本年度尚無排放紀錄」提示，不渲染空圖表
- Failure:
  - Given: getScopeSummary 拋出錯誤
  - When: 渲染元件
  - Then: 顯示「資料載入失敗」提示，提供重試按鈕，不白屏

**AC-2.3** — 看板頁路由
DOMAIN: Clear | ERROR_RETURNS: N/A
- Happy Path:
  - Given: 已登入使用者
  - When: 瀏覽 /dashboard
  - Then: 顯示看板，圖表有資料，無 console error
- Edge:
  - Given: 使用者未登入
  - When: 直接瀏覽 /dashboard
  - Then: 重導向至 /login，不顯示看板
- Failure:
  - Given: DashboardView 資料載入失敗
  - When: 頁面初始化
  - Then: ErrorBoundary 捕捉，顯示 fallback UI，不白屏

### Iter 4: report-gen [STUB]

> PDF 報告生成模組，依賴 shared + data-entry + dashboard
> Story 拆法: Story-0 報告生成服務 (SVC), Story-1 報告下載 UI (UI/ROUTE)

**函式 Flow 清單** (expand 時直接搬運):

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | AC |
|---------|------|---------|---|------|------|----|
| 生成 PDF 報告 | SVC | generateReport | P0 | FETCH_DATA→AGGREGATE→RENDER_TEMPLATE→EXPORT_PDF→RETURN | [getScopeSummary, getRecords] | AC-3.0 |
| 報告下載按鈕 | UI | ReportDownloadBtn | P1 | TRIGGER_GENERATE→SHOW_LOADING→DOWNLOAD_FILE→RESET | [Internal.generateReport] | AC-3.1 |
| 報告頁路由 | ROUTE | ReportPage | P1 | CHECK_AUTH→LOAD_ORG→RENDER_LAYOUT→RENDER_CONTENT | [Internal.ReportDownloadBtn] | AC-3.2 |

**驗收條件骨架**:

**AC-3.0** — 生成 PDF 報告
DOMAIN: Complicated | ERROR_RETURNS: ValidationError | ReportGenerationError
- Happy Path:
  - Given: org-001 在 2024 年有完整排放紀錄（至少 1 筆）
  - When: generateReport('org-001', 2024)
  - Then: 回傳 Buffer，MIME type 為 application/pdf，檔案大小 > 0
- Edge:
  - Given: org-001 在 2024 年無任何排放紀錄
  - When: generateReport('org-001', 2024)
  - Then: 仍回傳有效 PDF（含「本年度無排放紀錄」說明頁），不拋錯
- Failure:
  - Given: PDF 渲染引擎初始化失敗
  - When: generateReport('org-001', 2024)
  - Then: throw ReportGenerationError('PDF 生成失敗，請稍後重試')

**AC-3.1** — 報告下載按鈕
DOMAIN: Clear | ERROR_RETURNS: N/A
- Happy Path:
  - Given: 使用者在報告頁，generateReport 可用
  - When: 點擊「下載報告」按鈕
  - Then: 觸發 generateReport，顯示 loading，完成後自動下載 PDF，按鈕恢復可點擊
- Edge:
  - Given: 報告生成中（loading 狀態）
  - When: 使用者再次點擊按鈕
  - Then: 按鈕 disabled，不重複觸發 generateReport
- Failure:
  - Given: generateReport 拋出 ReportGenerationError
  - When: 使用者點擊按鈕
  - Then: 顯示「報告生成失敗，請稍後重試」，按鈕恢復可點擊

---

## ✅ 驗收條件

### Iter 1: shared

**AC-0.0** — CoreTypes 型別定義
DOMAIN: Clear | ERROR_RETURNS: N/A
- Happy Path:
  - Given: 專案初始化完成
  - When: import { Organization, EmissionRecord, EmissionFactor } from 'shared/types'
  - Then: TypeScript 編譯通過，Organization 含 id/name/industry/reportYear，EmissionRecord 含 co2e 欄位
- Edge:
  - When: 只 import 部分型別（如只 import Organization）
  - Then: 其餘型別不受影響，tree-shaking 正常，無 TypeScript 錯誤

**AC-0.1** — API 介面契約
DOMAIN: Clear | ERROR_RETURNS: N/A
- Happy Path:
  - Given: IServiceContracts 已定義
  - When: 實作類別 implements IDataEntryService
  - Then: TypeScript 強制要求實作所有方法簽名
- Failure:
  - When: 缺少任何方法
  - Then: TypeScript 編譯報錯，不可 build

**AC-0.2** — 資料庫連線
DOMAIN: Complicated | ERROR_RETURNS: DbConnectionError
- Happy Path:
  - Given: ENV_CONFIG 已載入，PostgreSQL 服務運行中
  - When: 呼叫 dbClient.query('SELECT 1')
  - Then: 回傳結果不為 null，連線池 pool.totalCount > 0
- Failure:
  - Given: PostgreSQL 服務未啟動
  - When: 呼叫 dbClient.query('SELECT 1')
  - Then: throw DbConnectionError('無法連線到資料庫')

**AC-0.3** — 排放係數 CRUD
DOMAIN: Complicated | ERROR_RETURNS: ValidationError | NotFoundError
- Happy Path:
  - Given: dbClient 已連線，emission_factors 表存在
  - When: factorService.create({ name: '台電電力', category: '電力', value: 0.494, unit: 'kgCO2e/kWh', source: '環保署', year: 2024 })
  - Then: 資料庫新增一筆紀錄，回傳含 id 的完整物件，factorService.findById(id) 回傳相同資料
- Edge:
  - Given: 同名同年度的係數已存在
  - When: factorService.create({ name: '台電電力', year: 2024, ... })
  - Then: throw ValidationError('係數已存在，請使用 update')
- Failure:
  - Given: value 為負數
  - When: factorService.create({ value: -0.5, ... })
  - Then: throw ValidationError('係數值不可為負數')

**AC-0.4** — 前端主入口殼
DOMAIN: Clear | ERROR_RETURNS: N/A
- Happy Path:
  - Given: npm run dev 啟動
  - When: 瀏覽器開啟 localhost
  - Then: 首頁框架可見（Header + 導覽列 + 主內容區），無 console error
- Failure:
  - Given: 子元件拋出 runtime error
  - When: 任意頁面渲染失敗
  - Then: ErrorBoundary 捕捉，顯示 fallback UI，不白屏

---

## 功能模組清單

- [x] 基礎建設 (types, config, dbClient)
- [x] 排放係數庫管理
- [x] 引導式數據填報
- [x] CO2e 自動換算
- [ ] 視覺化碳排看板
- [ ] PDF 報告生成

### 不做什麼

- 本迭代不做使用者登入/權限系統
- 本迭代不做多組織管理
- 本迭代不做範疇三供應鏈追蹤

---

## 釐清項目

### 使用者角色
- [x] 主要使用者：填報員 (輸入排放數據)
- [x] 次要使用者：管理者 (審核與報告)

### 核心目標
- [x] 解決問題：降低中小企業碳盤查合規門檻
- [x] 預期效益：從手動 Excel 填報轉為引導式系統填報

### 資料結構
- [x] 核心實體：Organization, EmissionRecord, EmissionFactor

### 邊界條件
- [x] 資料量限制：單組織年度最多 1000 筆排放紀錄
- [x] 同時操作：支援多人同時填報不同期間

---

## POC 驗證模式

**Level**: M

---

**草稿狀態**: [x] DONE
