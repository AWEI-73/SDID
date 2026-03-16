# EcoTrack - Blueprint

**日期**: 2026-03-13
**規模**: M

<!--
  Blueprint v5 — 全局索引（不含動作細節）
  EcoTrack: 企業碳排追蹤系統
-->

---

## 1. 目標

> 建立一個企業碳排追蹤系統，讓組織能登錄碳排資料、自動計算 CO2 當量、
> 並透過儀表板查看 Scope 分類統計與月趨勢。

**一句話目標**: 組織能登錄碳排資料並即時查看統計儀表板

**不做什麼**:
- 不做多租戶（單一組織）
- 不做碳權交易功能
- 不做 PDF 報表匯出

---

## 2. 設計

### 族群
- 管理員: 登錄碳排資料、查看統計（無權限分級）

### 實體

#### Organization
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| name | string | NOT NULL, VARCHAR(200) | 組織名稱 |
| industry | string | NOT NULL, VARCHAR(100) | 產業類別 |
| reportYear | number | NOT NULL | 報告年度 |
| createdAt | Date | NOT NULL | 建立時間 |

#### EmissionRecord
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| orgId | string | FK → Organization.id | 所屬組織 |
| scope | EmissionScope | NOT NULL | Scope 1/2/3 |
| category | string | NOT NULL, VARCHAR(100) | 排放類別 |
| amount | number | NOT NULL, >= 0 | 活動量 |
| unit | string | NOT NULL, VARCHAR(20) | 單位 |
| factorId | string | FK → EmissionFactor.id | 排放係數 |
| co2e | number | COMPUTED | CO2 當量 |
| period | string | NOT NULL, VARCHAR(7) | 期間 (YYYY-MM) |
| status | RecordStatus | DEFAULT 'DRAFT' | 狀態 |

#### EmissionFactor
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| name | string | NOT NULL, VARCHAR(100) | 係數名稱 |
| category | string | NOT NULL, VARCHAR(50) | 類別 |
| value | number | NOT NULL, >= 0 | 係數值 |
| unit | string | NOT NULL, VARCHAR(30) | 單位 |
| source | string | NOT NULL, VARCHAR(100) | 資料來源 |
| year | number | NOT NULL | 年度 |

### 路由結構
```
src/
├── config/
├── shared/types/
├── modules/
│   ├── DataEntry/     → 碳排資料登錄
│   └── Dashboard/     → 儀表板統計
└── index.ts
```

**樣式策略**: CSS Modules (.module.css)

---

## 3. 迭代規劃

| Iter | 模組 | 目標（一行） | 交付 | 狀態 |
|------|------|-------------|------|------|
| 1 | shared | 核心型別 + API 介面契約 + 排放係數種子 + 前端殼 | INFRA | [CURRENT] |
| 2 | DataEntry | 碳排資料登錄：輸入表單 + 係數查詢 + CO2e 自動計算 | FULL | [STUB] |
| 3 | Dashboard | 儀表板統計：Scope 分類統計 + 月趨勢圖表 | FULL | [STUB] |

### 模組 API 摘要
- shared: CoreTypes, EmissionScope, RecordStatus, ENV_CONFIG, IDataEntryService, IDashboardService
- DataEntry: createRecord(data)→EmissionRecord, getRecords(orgId,period)→EmissionRecord[], calcEmission(amount,factorId)→number
- Dashboard: getScopeSummary(orgId,year)→Record<Scope,number>, getTrendData(orgId,months)→TrendItem[]

---

## 4. 變異點（Simple，跳過）

| 名詞 | 固定/可變 | 說明 |
|------|----------|------|
| EmissionScope | [固定] | Scope 1/2/3 國際標準 |
| EmissionFactor | [固定] | 種子資料，iter-1 不做 CRUD |
