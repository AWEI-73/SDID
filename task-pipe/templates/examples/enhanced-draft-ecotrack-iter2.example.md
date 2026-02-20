# 📋 EcoTrack 碳盤查系統 - 活藍圖 (Living Blueprint)

**迭代**: iter-2  
**日期**: 2026-02-15  
**藍圖狀態**: [~] ACTIVE  
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

(族群、實體、共用模組、獨立模組、路由結構 — 同 iter-1，省略)

---

## 📅 迭代規劃表 (Iteration Planning)

| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別 + 配置 + 儲存層 + 排放係數庫 | shared | INFRA | 無 | [DONE] |
| 2 | Core MVP | 引導式數據填報 + CO2e 計算 | data-entry | FULL | shared | [CURRENT] |
| 3 | Visualization | 碳排看板 + 趨勢圖 | dashboard | FRONTEND | shared, data-entry | [STUB] |
| 4 | Report | PDF 報告生成 | report-gen | FULL | shared, data-entry, dashboard | [STUB] |

---

## 📋 模組動作清單 (Module Actions)

### Iter 1: shared [DONE]
> ✅ 4 個動作完成 (2×P0, 1×P1, 1×P2) | 測試: 12 pass

### Iter 2: data-entry [CURRENT]

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 狀態 |
|---------|------|---------|---|------|------|------|
| 數據填報型別定義 | CONST | DataEntryTypes | P0 | DEFINE→VALIDATE→FREEZE→EXPORT | [Internal.shared] | ○○ |
| 填報表單渲染 | UI | EntryForm | P0 | LOAD_FACTORS→RENDER_FIELDS→BIND_EVENTS | [Internal.CoreTypes, Internal.factorService] | ○○ |
| 排放數據新增 | API | createRecord | P0 | VALIDATE→CALC_CO2E→PERSIST→RETURN | [Internal.CoreTypes, Internal.dbClient] | ○○ |
| CO2e 自動計算 | SVC | calcEmission | P1 | GET_FACTOR→VALIDATE_AMOUNT→MULTIPLY→RETURN | [Internal.factorService] | ○○ |
| 填報資料查詢 | API | getRecords | P1 | VALIDATE_PARAMS→QUERY→FORMAT_DTO→RETURN | [Internal.CoreTypes, Internal.dbClient] | ○○ |
| 填報互動邏輯 | HOOK | useDataEntry | P2 | CALL_API→UPDATE_STATE→HANDLE_ERROR→RENDER | [Internal.createRecord, Internal.getRecords] | ○○ |

> 📝 Fillback 備註 (來自前一迭代):
> - factorService 的快取機制建議加入 TTL 過期策略
> - dbClient 連線池建議加入重試邏輯

### Iter 3: dashboard [STUB]

> 碳排分佈圖 + 年度趨勢圖，依賴 shared + data-entry
> 預估: 3 個動作 (1×P0, 1×P1, 1×P2)
> 公開 API: getScopeSummary, getTrendData

### Iter 4: report-gen [STUB]

> PDF 報告生成模組，依賴 shared + data-entry + dashboard
> 預估: 2-3 個動作
> 公開 API: generateReport

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

**藍圖狀態**: [~] ACTIVE
