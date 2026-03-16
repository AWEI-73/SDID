# {專案名稱} - 活藍圖 (Living Blueprint)

**迭代**: iter-1
**日期**: {YYYY-MM-DD}
**藍圖狀態**: [~] ACTIVE
**規模**: {S/M/L}

<!--
  活藍圖 v4 — 極簡版（7→6 區塊）
  
  v4 變更：
  - 移除獨立「驗收條件」區塊 — AC 骨架統一內嵌在動作清單的 STUB 區塊
  - 完整 AC 定義由 contract 承載，draft 只保留骨架級 Given/When/Then
  - 族群識別精簡為 inline 列表（不再用表格）
  - 模組 API 摘要精簡為依賴 + 一行 API 列表
  
  狀態流轉：
    [STUB] → (BLUEPRINT-CONTINUE 展開) → [CURRENT] → (BUILD 完成) → [DONE]
-->

---

## 1. 用戶原始需求

> {貼上原始 PRD 或需求描述，至少 50 字。}

**一句話目標**: {用一句話描述 MVP 要達成什麼，至少 10 字，不可含佔位符}

**不做什麼**:
- {明確排除項目 1}
- {明確排除項目 2}

---

## 2. 模組化設計藍圖

### 2.1 族群識別

- {角色A}: {職責描述}（{特殊需求}）
- {角色B}: {職責描述}（{特殊需求}）

### 2.2 實體定義 (Entity Tables)

#### {EntityA}
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| name | string | NOT NULL, VARCHAR(100) | 名稱 |
| status | enum | 'DRAFT'\|'ACTIVE'\|'ARCHIVED' | 狀態 |
| createdAt | Date | NOT NULL | 建立時間 |

### 2.3 路由結構

```
src/
├── config/          → 全域配置
├── shared/          → 跨模組共用
│   └── types/       → 共用型別
├── modules/         → 核心業務
│   ├── {moduleA}/   → {模組A 中文名}
│   └── {moduleB}/   → {模組B 中文名}
└── index.ts         → 應用入口
```

**樣式策略**: CSS Modules (.module.css)

---

## 3. 迭代規劃表 (Iteration Planning)

| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別 + 配置 + API 介面契約 + 前端殼 | shared | INFRA | 無 | [CURRENT] |
| 2 | Core MVP | {完整業務流程: 後端服務→前端串接} | {moduleA} | FULL | shared | [STUB] |
| 3 | Extension | {完整業務流程: 後端服務→前端串接} | {moduleB} | FULL | shared, {moduleA} | [STUB] |

### 模組 API 摘要

#### shared
- 依賴: 無
- API: CoreTypes, ENV_CONFIG, IServiceContracts

#### {moduleA}
- 依賴: [shared/types]
- API: {functionA}(args): ReturnType, {functionB}(args): ReturnType

#### {moduleB}
- 依賴: [shared/types, {moduleA}]
- API: {functionC}(args): ReturnType

---

## 4. 變異點分析 (Variation Points)

<!--
  條件區塊：只有需求含「彈性/可變/不固定/客製化」時才出現。
  CYNEFIN = Simple 時整塊跳過。
-->

### 名詞分析

| 名詞 | 固定/可變 | 說明 |
|------|----------|------|
| {名詞A} | [固定] | {為什麼固定} |
| {名詞B} | [可變] | {什麼情況下會變} |

### 分層定義

| 層 | 名稱 | 新增維度 | API 變化 | 對應 Iter |
|----|------|---------|---------|----------|
| BASE | {基礎版} | 無 (全固定) | {baseFunction}(fixedArgs) → Result | 1 |
| L1 | {第一層彈性} | {名詞B 可變} | + {newParam}: Type | 2 |

### 確認狀態

- [x] BASE: {描述} — 本次實作
- [ ] L1: {描述} — 計畫 iter-2

---

## 5. 模組動作清單 (Module Actions)

### Iter 1: shared [CURRENT]

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | 操作 | 狀態 | 演化 | AC |
|---------|------|---------|-----------|---|------|------|------|------|------|----|
| 核心型別定義 | CONST | CoreTypes | N/A | P0 | DEFINE→FREEZE→EXPORT | 無 | NEW | ○○ | BASE | AC-0.0 |
| 環境變數管理 | CONST | ENV_CONFIG | N/A | P2 | LOAD→VALIDATE→EXPORT | 無 | NEW | ○○ | BASE | - |
| API 介面契約 | CONST | IServiceContracts | N/A | P1 | DEFINE→VALIDATE→EXPORT | [Internal.CoreTypes] | NEW | ○○ | BASE | AC-0.1 |
| 前端主入口殼 | ROUTE | AppRouter | N/A | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [Internal.CoreTypes] | NEW | ○○ | BASE | AC-0.2 |

**AC 骨架** (P0/P1):

- AC-0.0 — CoreTypes: Given 專案已初始化 / When tsc --noEmit / Then 編譯成功
- AC-0.1 — IServiceContracts: Given 已定義 / When implements IXxxService / Then TS 強制實作所有方法
- AC-0.2 — AppRouter: Given npm run dev / When 開啟 localhost / Then 首頁框架可見，無 console error

### Iter 2: {moduleA} [STUB]

> {模組描述}，依賴 shared
> Story 拆法: Story-0 後端 (SVC/API), Story-1 前端串接 (UI/ROUTE)

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | AC |
|---------|------|---------|-----------|---|------|------|----|
| {functionA 業務描述} | SVC | {functionA} | ({param}: {Type}) → {ReturnType} | P0 | {STEP1→STEP2→STEP3→RETURN} | [shared/types] | AC-1.0 [CALC] |
| {functionB 業務描述} | SVC | {functionB} | ({param}: {Type}) → {ReturnType} | P1 | {STEP1→STEP2→RETURN} | [Internal.{functionA}] | AC-1.1 [MOCK] |
| {UI 元件描述} | UI | {ModuleView} | N/A | P1 | FETCH_DATA→RENDER→BIND_EVENTS | [Internal.{functionA}] | AC-1.2 [MANUAL] |
| {路由描述} | ROUTE | {ModulePage} | N/A | P1 | CHECK_AUTH→LOAD_DATA→RENDER_LAYOUT | [Internal.{ModuleView}] | AC-1.3 [MANUAL] |

**AC 骨架** (P0/P1):

- AC-1.0 [CALC] — {functionA}: Given {前置狀態} / When `{functionA}({testValue})` / Then `{關鍵欄位}` = `{預期值}`
- AC-1.1 [MOCK] — {functionB}: Given 已存在 {條件} 資料 2 筆 / When `{functionB}('{過濾值}')` / Then 只返回符合的 2 筆
- AC-1.2 [MANUAL] — {ModuleView}: Given 有 2 筆資料 / When 渲染元件 / Then 顯示 2 筆卡片
- AC-1.3 [MANUAL] — {ModulePage}: Given npm run dev / When 開啟頁面 / Then 頁面可見，無 error

---

## 6. 藍圖備註

**藍圖狀態**: [~] ACTIVE
