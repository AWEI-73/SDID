# EcoTrack 碳盤查系統 - 活藍圖 (Living Blueprint)

**迭代**: iter-1
**日期**: 2026-02-08
**藍圖狀態**: [~] ACTIVE
**規模**: M

---

## 1. 用戶原始需求

> EcoTrack 提供一個直覺化的數據填報與自動生成報告系統，降低中小企業 ESG 碳盤查合規門檻。
> 目標客群為製造業供應鏈中的中小企業及需要建立永續報告書的上市公司。
> 技術架構：React 前端、Node.js (Express) 後端、PostgreSQL 資料庫。

**一句話目標**: 讓中小企業能透過引導式填報快速完成碳盤查，並一鍵生成合規 PDF 報告。

**不做什麼**:
- 本迭代不做使用者登入/權限系統
- 本迭代不做多組織管理
- 本迭代不做範疇三供應鏈追蹤

---

## 2. 模組化設計藍圖

### 2.1 族群識別

- 填報員: 負責輸入電力、燃油、水耗等數據（引導式表單、資料暫存）
- 管理者: 審核數據、生成報告（看板總覽、報告匯出）
- 系統管理員: 管理排放係數庫、組織設定（係數 CRUD、權限管理）

### 2.2 實體定義 (Entity Tables)

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

### 2.3 路由結構

```
src/
├── config/            → 全域配置 (環境變數、常數)
├── lib/               → 第三方庫封裝 (DB Client)
├── shared/            → 跨模組共用
│   ├── types/         → 共用型別
│   └── contracts/     → API 介面契約
├── modules/           → 核心業務
│   ├── data-entry/    → 數據填報
│   ├── dashboard/     → 視覺化看板
│   └── report-gen/    → 報告生成
└── index.ts           → 應用入口
```

**樣式策略**: CSS Modules (.module.css)

---

## 3. 迭代規劃表 (Iteration Planning)

| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別 + API 介面契約 + 前端殼 + 儲存層 | shared | INFRA | 無 | [CURRENT] |
| 2 | Core MVP | 引導式數據填報 + CO2e 計算 (後端→前端) | data-entry | FULL | shared | [STUB] |
| 3 | Visualization | 碳排看板 + 趨勢圖 (後端→前端) | dashboard | FULL | shared, data-entry | [STUB] |
| 4 | Report | PDF 報告生成 + 下載 UI | report-gen | FULL | shared, data-entry, dashboard | [STUB] |

### 模組 API 摘要

#### shared
- 依賴: 無
- API: CoreTypes, ENV_CONFIG, IDataEntryService, IDashboardService, dbClient, factorService(data: FactorInput): EmissionFactor

#### data-entry
- 依賴: [shared/types, shared/storage]
- API: createRecord(data: RecordInput): Promise<EmissionRecord>, getRecords(orgId: string, period: string): Promise<EmissionRecord[]>, calcEmission(amount: number, factorId: string): number

#### dashboard
- 依賴: [shared/types, data-entry]
- API: getScopeSummary(orgId: string, year: number): Promise<ScopeSummary>, getTrendData(orgId: string, months: number): Promise<TrendPoint[]>

#### report-gen
- 依賴: [shared/types, data-entry, dashboard]
- API: generateReport(orgId: string, year: number): Promise<ReportPDF>

---

## 5. 模組動作清單 (Module Actions)

### Iter 1: shared [CURRENT]

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | 操作 | 狀態 | 演化 | AC |
|---------|------|---------|-----------|---|------|------|------|------|------|----|
| 核心型別定義 | CONST | CoreTypes | N/A | P0 | DEFINE→FREEZE→EXPORT | 無 | NEW | ○○ | BASE | AC-0.0 |
| 環境變數管理 | CONST | ENV_CONFIG | N/A | P2 | LOAD→VALIDATE→EXPORT | 無 | NEW | ○○ | BASE | - |
| API 介面契約 | CONST | IServiceContracts | N/A | P1 | DEFINE→VALIDATE→EXPORT | [Internal.CoreTypes] | NEW | ○○ | BASE | AC-0.1 |
| 資料庫連線 | LIB | dbClient | N/A | P0 | CONNECT→POOL→HEALTH_CHECK→EXPORT | [Internal.ENV_CONFIG] | NEW | ○○ | BASE | AC-0.2 |
| 排放係數 CRUD | SVC | factorService | (data: FactorInput) → EmissionFactor | P1 | VALIDATE→PERSIST→CACHE→RETURN | [Internal.CoreTypes, Internal.dbClient] | NEW | ○○ | BASE | AC-0.3 |
| 前端主入口殼 | ROUTE | AppRouter | N/A | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [Internal.CoreTypes] | NEW | ○○ | BASE | AC-0.4 |

**AC 骨架** (P0/P1):

- AC-0.0 — CoreTypes: Given 專案初始化 / When import 核心型別 / Then TS 編譯通過
- AC-0.1 — IServiceContracts: Given 已定義 / When implements IDataEntryService / Then TS 強制實作所有方法
- AC-0.2 — dbClient: Given ENV_CONFIG 已載入 / When dbClient.query('SELECT 1') / Then 回傳非 null，pool.totalCount > 0
- AC-0.3 — factorService: Given dbClient 已連線 / When create({ name: '台電電力', value: 0.494, ... }) / Then 新增一筆，回傳含 id
- AC-0.4 — AppRouter: Given npm run dev / When 開啟 localhost / Then 首頁框架可見，無 console error

### Iter 2: data-entry [STUB]

> 引導式數據填報 + CO2e 自動計算，依賴 shared
> Story 拆法: Story-0 後端計算層 (SVC/API), Story-1 填報 UI (UI/ROUTE)

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | AC |
|---------|------|---------|-----------|---|------|------|----|
| CO2e 排放量計算 | SVC | calcEmission | (amount: number, factorId: string) → number | P0 | VALIDATE_INPUT→LOOKUP_FACTOR→MULTIPLY→ROUND→RETURN | [shared/types, factorService] | AC-1.0 [CALC] |
| 新增排放紀錄 | SVC | createRecord | (data: RecordInput) → Promise<EmissionRecord> | P0 | VALIDATE→CALC_CO2E→PERSIST→RETURN | [Internal.calcEmission, dbClient] | AC-1.1 [MOCK] |
| 查詢排放紀錄 | SVC | getRecords | (orgId: string, period: string) → Promise<EmissionRecord[]> | P1 | VALIDATE_PARAMS→QUERY→TRANSFORM→RETURN | [Internal.CoreTypes, dbClient] | AC-1.2 [MOCK] |
| 填報表單元件 | UI | DataEntryForm | N/A | P1 | LOAD_FACTORS→RENDER_FORM→VALIDATE_INPUT→SUBMIT | [Internal.createRecord, factorService] | AC-1.3 [MANUAL] |
| 填報頁路由 | ROUTE | DataEntryPage | N/A | P1 | CHECK_AUTH→LOAD_DATA→RENDER_LAYOUT→RENDER_CONTENT | [Internal.DataEntryForm] | AC-1.4 [MANUAL] |

**AC 骨架** (P0/P1):

- AC-1.0 [CALC] — calcEmission: Given factorId='elec-tw-2024' 係數 0.494 / When calcEmission(1000, 'elec-tw-2024') / Then 回傳 494 kgCO2e
- AC-1.1 [MOCK] — createRecord: Given dbClient 已連線 / When createRecord({ orgId: 'org-001', scope: 'SCOPE2', amount: 1000 }) / Then 新增一筆，co2e=494
- AC-1.2 [MOCK] — getRecords: Given org-001 有 3 筆紀錄 / When getRecords('org-001', '2024-01') / Then 回傳 3 筆
- AC-1.3 [MANUAL] — DataEntryForm: Given 係數已載入 / When 填入數據送出 / Then 清單新增一筆
- AC-1.4 [MANUAL] — DataEntryPage: Given npm run dev / When 開啟填報頁 / Then 表單可見，無 error

### Iter 3: dashboard [STUB]

> 碳排分佈圖 + 年度趨勢圖，依賴 shared + data-entry
> Story 拆法: Story-0 統計計算層 (SVC), Story-1 圖表 UI (UI/ROUTE)

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | AC |
|---------|------|---------|-----------|---|------|------|----|
| 範疇分佈統計 | SVC | getScopeSummary | (orgId: string, year: number) → Promise<ScopeSummary> | P0 | QUERY_RECORDS→GROUP_BY_SCOPE→SUM_CO2E→RETURN | [getRecords, CoreTypes] | AC-2.0 [MOCK] |
| 月度趨勢計算 | SVC | getTrendData | (orgId: string, months: number) → Promise<TrendPoint[]> | P1 | QUERY_RANGE→AGGREGATE_BY_MONTH→SORT→RETURN | [getRecords] | AC-2.1 [MOCK] |
| 碳排看板元件 | UI | DashboardView | N/A | P1 | FETCH_SUMMARY→FETCH_TREND→RENDER_CHARTS→BIND_FILTER | [getScopeSummary, getTrendData] | AC-2.2 [MANUAL] |
| 看板頁路由 | ROUTE | DashboardPage | N/A | P1 | CHECK_AUTH→LOAD_ORG→RENDER_LAYOUT→RENDER_CONTENT | [Internal.DashboardView] | AC-2.3 [MANUAL] |

**AC 骨架** (P0/P1):

- AC-2.0 [MOCK] — getScopeSummary: Given org-001 有 SCOPE1:200, SCOPE2:800 / When getScopeSummary('org-001', 2024) / Then { SCOPE1:200, SCOPE2:800, total:1000 }
- AC-2.1 [MOCK] — getTrendData: Given org-001 有 3 個月資料 / When getTrendData('org-001', 3) / Then 回傳 3 筆 TrendPoint
- AC-2.2 [MANUAL] — DashboardView: Given 統計資料已載入 / When 渲染看板 / Then 圓餅圖+趨勢圖可見
- AC-2.3 [MANUAL] — DashboardPage: Given npm run dev / When 開啟看板頁 / Then 圖表可見，無 error

### Iter 4: report-gen [STUB]

> PDF 報告生成模組，依賴 shared + data-entry + dashboard
> Story 拆法: Story-0 報告生成服務 (SVC), Story-1 報告下載 UI (UI/ROUTE)

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | AC |
|---------|------|---------|-----------|---|------|------|----|
| 生成 PDF 報告 | SVC | generateReport | (orgId: string, year: number) → Promise<ReportPDF> | P0 | FETCH_DATA→AGGREGATE→RENDER_TEMPLATE→EXPORT_PDF→RETURN | [getScopeSummary, getRecords] | AC-3.0 [MOCK] |
| 報告下載按鈕 | UI | ReportDownloadBtn | N/A | P1 | TRIGGER_GENERATE→SHOW_LOADING→DOWNLOAD_FILE→RESET | [Internal.generateReport] | AC-3.1 [MANUAL] |
| 報告頁路由 | ROUTE | ReportPage | N/A | P1 | CHECK_AUTH→LOAD_ORG→RENDER_LAYOUT→RENDER_CONTENT | [Internal.ReportDownloadBtn] | AC-3.2 [MANUAL] |

**AC 骨架** (P0/P1):

- AC-3.0 [MOCK] — generateReport: Given org-001 有完整 2024 排放紀錄 / When generateReport('org-001', 2024) / Then 回傳 Buffer，MIME=application/pdf
- AC-3.1 [MANUAL] — ReportDownloadBtn: Given 報告已生成 / When 點擊下載 / Then 瀏覽器下載 PDF
- AC-3.2 [MANUAL] — ReportPage: Given npm run dev / When 開啟報告頁 / Then 下載按鈕可見，無 error
