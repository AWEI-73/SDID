# 📋 EcoTrack 碳盤查系統 - 活藍圖 (Living Blueprint)

**迭代**: iter-1  
**日期**: 2026-02-08  
**草稿狀態**: [x] DONE  
**規模**: M  
**方法論**: SDID v2.0

---

## 用戶原始需求

> EcoTrack 提供一個直覺化的數據填報與自動生成報告系統，降低中小企業 ESG 碳盤查合規門檻。
> 目標客群為製造業供應鏈中的中小企業及需要建立永續報告書的上市公司。
> 技術架構：React/Vue.js 前端、Node.js (Express) 後端、PostgreSQL 資料庫。

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
- [x] 儲存層封裝 (PostgreSQL CRUD)
- [ ] 通用 UI 元件 (表單、表格、通知)

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
│   ├── components/    → 原子元件 (表單、表格)
│   ├── hooks/         → 通用 Hooks
│   ├── store/         → 全域狀態 (UserSession)
│   ├── utils/         → 純函數工具
│   └── types/         → 共用型別 (Organization, EmissionRecord, EmissionFactor)
├── modules/           → 核心業務
│   ├── data-entry/    → 數據填報 (引導式表單、CO2e 計算)
│   │   ├── index.ts
│   │   ├── api/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── components/
│   │   └── pages/
│   ├── dashboard/     → 視覺化看板 (碳排分佈、趨勢圖)
│   └── report-gen/    → 報告生成 (PDF 碳盤查清冊)
├── routes/            → 路由定義
│   └── router.ts
└── index.ts           → 應用入口
```

---

## 📅 迭代規劃表 (Iteration Planning)

<!--
  交付類型: FULL (前後端一體) | BACKEND | FRONTEND | INFRA (純基礎設施)
  狀態: [CURRENT] 當前迭代 | [STUB] 待展開 | [DONE] 已完成
  deps=[] 的模組可並行開發 (Multi-Agent Ready)
-->

| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別 + 配置 + 儲存層 + 排放係數庫 | shared | INFRA | 無 | [CURRENT] |
| 2 | Core MVP | 引導式數據填報 + CO2e 計算 | data-entry | FULL | shared | [STUB] |
| 3 | Visualization | 碳排看板 + 趨勢圖 | dashboard | FRONTEND | shared, data-entry | [STUB] |
| 4 | Report | PDF 報告生成 | report-gen | FULL | shared, data-entry, dashboard | [STUB] |

---

## 📋 模組動作清單 (Module Actions)

<!--
  v2 格式：動作清單攜帶 GEMS 標籤資訊，可直接轉換為 implementation_plan

  欄位說明：
  - 業務語意: 用中文描述這個動作做什麼
  - 類型: CONST/LIB/API/SVC/HOOK/UI/ROUTE/SCRIPT
  - 技術名稱: 函式名或類型名 (對應 GEMS 標籤的函式名)
  - P: 優先級 P0-P3
  - 流向: STEP1→STEP2→STEP3 (對應 GEMS-FLOW，3-7 步)
  - 依賴: [Type.Name] 格式 (對應 GEMS-DEPS)
  - 狀態: ○○ (未開始) | ✓✓ (完成)
-->

### Iter 1: shared [CURRENT]

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | AC | 狀態 |
|---------|------|---------|---|------|------|-----|------|
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE→FREEZE→EXPORT | 無 | AC-1.0 | ○○ |
| 環境變數管理 | CONST | ENV_CONFIG | P2 | LOAD→VALIDATE→EXPORT | 無 | - | ○○ |
| 資料庫連線 | LIB | dbClient | P0 | CONNECT→POOL→HEALTH_CHECK→EXPORT | [Internal.ENV_CONFIG] | AC-1.1 | ○○ |
| 排放係數 CRUD | SVC | factorService | P1 | VALIDATE→PERSIST→CACHE→RETURN | [Internal.CoreTypes, Internal.dbClient] | AC-1.2 | ○○ |

### Iter 2: data-entry [STUB]

> 引導式數據填報 + CO2e 自動計算，依賴 shared
> 預估: 5 個動作 (2×P0, 2×P1, 1×P2)
> 公開 API: createRecord, getRecords, calcEmission

### Iter 3: dashboard [STUB]

> 碳排分佈圖 + 年度趨勢圖，依賴 shared + data-entry
> 預估: 3 個動作 (1×P0, 1×P1, 1×P2)
> 公開 API: getScopeSummary, getTrendData

### Iter 4: report-gen [STUB]

> PDF 報告生成模組，依賴 shared + data-entry + dashboard
> 預估: 2-3 個動作
> 公開 API: generateReport

---

## ✅ 驗收條件

### AC-1.0: CoreTypes 型別定義
- Given: 專案初始化完成
- When: import CoreTypes
- Then: Organization, EmissionRecord, EmissionFactor 型別可用，TypeScript 編譯通過

### AC-1.1: dbClient 資料庫連線
- Given: ENV_CONFIG 已載入
- When: 呼叫 dbClient.query()
- Then: 成功連線 PostgreSQL 並回傳結果，連線池正常運作

### AC-1.2: factorService 排放係數 CRUD
- Given: dbClient 已連線，CoreTypes 已定義
- When: 呼叫 factorService.create/read/update/delete
- Then: 排放係數資料正確寫入/讀取/更新/刪除，快取機制生效

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
