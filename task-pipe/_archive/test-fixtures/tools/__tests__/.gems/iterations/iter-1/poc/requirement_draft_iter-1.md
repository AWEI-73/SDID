# 📋 EcoTrack 碳盤查系統 - 需求草稿 (Enhanced Blueprint Draft)

**迭代**: iter-1  
**日期**: 2026-02-08  
**狀態**: 🔄 待驗證  
**規模**: M  
**方法論**: SDID v1.0

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
| category | string | NOT NULL | 排放類別 |
| amount | number | NOT NULL, >= 0 | 活動數據量 |
| unit | string | NOT NULL | 單位 |
| factorId | string | FK → EmissionFactor.id | 使用的排放係數 |
| co2e | number | COMPUTED | 二氧化碳當量 |
| period | string | NOT NULL | 填報期間 |

#### EmissionFactor
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| name | string | NOT NULL | 係數名稱 |
| category | string | NOT NULL | 類別 |
| value | number | NOT NULL | 係數值 |
| unit | string | NOT NULL | 單位 |
| source | string | NOT NULL | 來源 |
| year | number | NOT NULL | 適用年度 |

### 3. 共用模組 (Shared)

- [x] 基礎建設 (types, config, constants)
- [x] 儲存層封裝 (PostgreSQL CRUD)
- [ ] 通用 UI 元件 (表單、表格、通知)

### 4. 獨立模組 (Modules)

#### 模組：data-entry (數據填報)
- 依賴: [shared/types, shared/storage]
- 獨立功能:
  - [x] ISO 14064-1 引導式填報表單
  - [x] 排放係數自動帶入
  - [x] CO2e 自動換算
  - [ ] 資料暫存與續填

#### 模組：dashboard (視覺化看板)
- 依賴: [shared/types, data-entry]
- 獨立功能:
  - [x] 碳排分佈圖 (範疇一、二、三)
  - [x] 年度趨勢圖
  - [ ] 同業比較

#### 模組：report-gen (報告生成)
- 依賴: [shared/types, data-entry, dashboard]
- 獨立功能:
  - [ ] 一鍵生成 PDF 碳盤查清冊
  - [ ] 符合 ISO 14064-1 格式

### 5. 路由結構

```
main.ts
└── router.ts
    ├── /shared/* → 共用元件與邏輯
    ├── /entry/* → 數據填報模組
    ├── /dashboard/* → 視覺化看板
    └── /report/* → 報告生成
```

---

## 📅 迭代規劃表 (Iteration Planning)

| Iter | 範圍 | 目標 | 模組 | 依賴 |
|------|------|------|------|------|
| 1 | Foundation | 型別 + 配置 + 儲存層 + 排放係數庫 | shared | 無 |
| 2 | Core MVP | 引導式數據填報 + CO2e 計算 | data-entry | shared |
| 3 | Visualization | 碳排看板 + 趨勢圖 | dashboard | shared, data-entry |
| 4 | Report | PDF 報告生成 | report-gen | shared, data-entry, dashboard |

---

## 📋 模組動作清單 (Module Actions)

### Iter 1: shared

| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
|---------|------|---------|--------|------|
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE → FREEZE → EXPORT |
| 環境變數管理 | CONST | ENV_CONFIG | P2 | LOAD → VALIDATE → EXPORT |
| 資料庫連線 | LIB | dbClient | P0 | CONNECT → POOL → EXPORT |
| 排放係數 CRUD | SVC | factorService | P1 | VALIDATE → PERSIST → RETURN |

### Iter 2: data-entry

| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
|---------|------|---------|--------|------|
| 填報表單渲染 | UI | EntryForm | P0 | LOAD_FACTORS → RENDER_FIELDS → BIND_EVENTS |
| 排放數據新增 | API | createRecord | P0 | VALIDATE → CALC_CO2E → PERSIST |
| CO2e 自動計算 | SVC | calcEmission | P0 | GET_FACTOR → MULTIPLY → RETURN |
| 填報資料查詢 | API | getRecords | P1 | QUERY → FORMAT → RETURN_DTO |
| 填報互動邏輯 | HOOK | useDataEntry | P1 | CALL_API → UPDATE_STATE → RENDER |

### Iter 3: dashboard (Partial)

| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
|---------|------|---------|--------|------|
| 碳排分佈圖 | UI | ScopeChart | P0 | FETCH_DATA → AGGREGATE → RENDER_CHART |
| 年度趨勢圖 | UI | TrendChart | P1 | FETCH_DATA → GROUP_BY_MONTH → RENDER |

### Iter 4: report-gen (Stub)

> PDF 報告生成模組，具體動作待 Iter 3 完成後細化

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

**草稿狀態**: [~] PENDING
