# 📋 {專案名稱} - 活藍圖 (Living Blueprint)

**迭代**: iter-1  
**日期**: {YYYY-MM-DD}  
**藍圖狀態**: [~] ACTIVE  
**規模**: {S/M/L}  
**方法論**: SDID v2.1

---

## 用戶原始需求

> {貼上原始 PRD 或需求描述，至少 50 字。}

---

## 一句話目標

{用一句話描述 MVP 要達成什麼，至少 10 字，不可含佔位符}

---

## 🏗️ 模組化設計藍圖

### 1. 族群識別

| 族群名稱 | 描述 | 特殊需求 |
|---------|------|---------|
| {角色A} | {職責描述} | {特殊業務邏輯} |
| {角色B} | {職責描述} | {特殊業務邏輯} |

### 2. 實體定義 (Entity Tables)

#### {EntityA}
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| name | string | NOT NULL, VARCHAR(100) | 名稱 |
| status | enum | 'DRAFT'\|'ACTIVE'\|'ARCHIVED' | 狀態 |
| createdAt | Date | NOT NULL | 建立時間 |

#### {EntityB}
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| entityAId | string | FK → EntityA.id | 關聯 EntityA |
| value | number | NOT NULL, >= 0 | 數值 |

### 3. 共用模組 (Shared)

- [x] 基礎建設 (types, config, constants)
- [ ] 儲存層封裝 (CRUD 操作)
- [ ] 通用 UI 元件 (表單、表格、通知)

### 4. 獨立模組 (Modules)

#### 模組：{moduleA} ({中文名稱})
- 依賴: [shared/types, shared/storage]
- 公開 API (index.ts):
  - {functionA}(args): ReturnType
  - {functionB}(args): ReturnType
- 獨立功能:
  - [x] {已確認的功能描述}
  - [ ] {待定的功能描述}

#### 模組：{moduleB} ({中文名稱})
- 依賴: [shared/types, moduleA]
- 公開 API (index.ts):
  - {functionC}(args): ReturnType
- 獨立功能:
  - [x] {已確認的功能描述}
  - [ ] {待定的功能描述}

### 5. 路由結構

```
src/
├── config/          → 全域配置
├── lib/             → 第三方庫封裝
├── shared/          → 跨模組共用
│   ├── types/       → 共用型別
│   ├── storage/     → 儲存層
│   └── validation/  → 驗證邏輯
├── modules/         → 核心業務
│   ├── {moduleA}/   → {模組A 中文名}
│   └── {moduleB}/   → {模組B 中文名}
└── index.ts         → 應用入口
```

---

## 📅 迭代規劃表 (Iteration Planning)

<!--
  交付類型: FULL (前後端一體) | INFRA (純基礎設施，例如 iter-1 Foundation)
  ⚠ 禁止使用 BACKEND 或 FRONTEND — 每個功能性 iter 必須前後端一套 (VSC-003)

  狀態: [CURRENT] 當前迭代 | [STUB] 待展開 | [DONE] 已完成

  Action Budget 上限 (blueprint-gate BUDGET-001):
    Level S: 每個功能性 iter 最多 3 個動作
    Level M: 每個功能性 iter 最多 4 個動作
    Level L: 每個功能性 iter 最多 5 個動作
    Foundation iter (全 CONST/LIB/SCRIPT) 豁免

  Complicated + q3_costly 模組 (CYNEFIN Budget):
    - 每 iter 最多 4 個動作，超出需拆成多個 iter
    - 例: 6 個動作 → ceil(6/4) = 2 iter 最少

  deps=[] 的模組可並行開發 (Multi-Agent Ready)
-->

| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別 + 配置 + 儲存層 | shared | INFRA | 無 | [CURRENT] |
| 2 | Core MVP | {核心業務功能} | {moduleA} | FULL | shared | [STUB] |
| 3 | Extension | {擴展功能} | {moduleB} | FULL | shared, {moduleA} | [STUB] |

---

## 🔄 變異點分析 (Variation Points)

<!--
  v2.1 新增：當需求包含「彈性」「可變」「不固定」「客製化」等詞彙時，
  Architect 會在 Round 1.5 觸發分層拆解，產出此區塊。

  規則：
  - 每一層只加入一個可變維度
  - BASE 層 = 所有名詞都固定的最簡版本
  - 每層的 API 變化 = 新增參數或新增函式
  - 使用者確認要做到哪一層 → 對應迭代規劃
  - 演化欄位: BASE / L1 / L2 / L3 ...
-->

### 名詞分析

| 名詞 | 固定/可變 | 說明 |
|------|----------|------|
| {名詞A} | [固定] | {為什麼固定} |
| {名詞B} | [可變] | {什麼情況下會變} |
| {名詞C} | [可變] | {什麼情況下會變} |

### 分層定義

| 層 | 名稱 | 新增維度 | API 變化 | 對應 Iter |
|----|------|---------|---------|----------|
| BASE | {基礎版} | 無 (全固定) | {baseFunction}(fixedArgs) → Result | 1 |
| L1 | {第一層彈性} | {名詞B 可變} | {baseFunction}(fixedArgs, {名詞B}: Type) → Result | 2 |
| L2 | {第二層彈性} | {名詞C 可變} | {baseFunction}(fixedArgs, {名詞B}, {名詞C}: Type) → Result | 3 |

### 確認狀態

- [x] BASE: {描述} — 本次實作
- [ ] L1: {描述} — 計畫 iter-2
- [ ] L2: {描述} — 計畫 iter-3

---

## 📋 模組動作清單 (Module Actions)

<!--
  v2.2 格式：動作清單攜帶 GEMS 標籤資訊 + 演化層標記 + AC 驗收條件編號

  欄位說明：
  - 業務語意: 用中文描述這個動作做什麼
  - 類型: CONST/LIB/API/SVC/HOOK/UI/ROUTE/SCRIPT
  - 技術名稱: 函式名或類型名 (對應 GEMS 標籤的函式名)
  - P: 優先級 P0-P3
  - 流向: STEP1→STEP2→STEP3 (對應 GEMS-FLOW，3-7 步)
  - 依賴: [Type.Name] 格式 (對應 GEMS-DEPS)
  - 狀態: ○○ (未開始) | ✓✓ (完成)
  - 演化: BASE / L1 / L2 ... (v2.1 新增，標記此動作屬於哪個演化層)
  - AC: 驗收條件編號 (v2.2 新增，對應下方「驗收條件」區塊的 AC-X.Y)
       P0/P1 必填，P2/P3 選填。格式: AC-1.0 / AC-1.1 / AC-1.2 ...

  動作類型:
  - New: 全新函式
  - Modify: 修改既有函式 (加參數/改邏輯，v2.1 新增)

  優先級定義:
  - P0: 端到端協議 (API/DB/第三方串接) → Unit + Integration 測試
  - P1: 整合依賴 (跨模組呼叫) → Unit + Integration 測試
  - P2: 獨立功能 (純邏輯/獨立 UI) → Unit 測試
  - P3: 輔助功能 (日誌/格式化/工具) → Unit 測試
-->

### Iter 1: shared [CURRENT]

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 狀態 | 演化 | AC |
|---------|------|---------|---|------|------|------|------|----|
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE→FREEZE→EXPORT | 無 | ○○ | BASE | AC-0.0 |
| 環境變數管理 | CONST | ENV_CONFIG | P2 | LOAD→VALIDATE→EXPORT | 無 | ○○ | BASE | - |
| 儲存層封裝 | LIB | storage | P1 | INIT→CRUD_OPS→EXPORT | [Internal.CoreTypes] | ○○ | BASE | AC-0.1 |

### Iter 2: {moduleA} [STUB]

> {模組描述}，依賴 shared
> 預估: {N} 個動作 ({M}×P0, {K}×P1)  ⚠ Level M 上限 4 個動作，超出需拆 iter
> 公開 API: {functionA}, {functionB}
> 必含: SVC/API + ROUTE + UI（前後端一套，delivery = FULL）

### Iter 3: {moduleB} [STUB]

> {模組描述}，依賴 shared + {moduleA}
> 預估: {N} 個動作  ⚠ Level M 上限 4 個動作，超出需拆 iter
> 公開 API: {functionC}
> 必含: SVC/API + ROUTE + UI（前後端一套，delivery = FULL）

---

## ✅ 驗收條件 (Acceptance Criteria)

<!--
  v2.2 新增：每個 P0/P1 動作必須有對應的 AC 條目。
  格式: AC-{iterNum}.{index}，從 0 開始。
  Given/When/Then 對應 BDD 風格，draft-to-plan 轉換時直接帶入 implementation_plan。

  規則:
  - P0/P1 動作必須有 AC（Gate 規則 ACC-001）
  - P2/P3 動作可選填（填了更好）
  - 每個 AC 只描述一個可驗證的行為
  - Given: 前置條件（系統狀態）
  - When: 觸發動作（呼叫什麼）
  - Then: 預期結果（可斷言的輸出）
-->

### Iter 1: shared

**AC-0.0** — CoreTypes 型別定義
- Given: 專案初始化
- When: import CoreTypes
- Then: 所有核心型別可用，TypeScript 編譯無錯誤

**AC-0.1** — 儲存層封裝
- Given: 空的 MemoryStore
- When: 呼叫 CRUD 操作
- Then: 資料正確存取，不同 key 互不干擾

### Iter 2: {moduleA}

**AC-1.0** — {functionA 的驗收條件}
- Given: {前置條件}
- When: {呼叫 functionA(args)}
- Then: {預期結果，可斷言}

**AC-1.1** — {functionB 的驗收條件}
- Given: {前置條件}
- When: {呼叫 functionB(args)}
- Then: {預期結果，可斷言}

---

## 功能模組清單

- [x] 基礎建設 (types, config, storage)
- [x] {moduleA 核心功能描述}
- [ ] {moduleB 擴展功能描述}

### 不做什麼

- {明確排除項目 1}
- {明確排除項目 2}

---

## 釐清項目

### 使用者角色
- [x] 主要使用者：{描述}
- [x] 次要使用者：{描述}

### 核心目標
- [x] 解決問題：{描述}
- [x] 預期效益：{描述}

### 資料結構
- [x] 核心實體：{列出實體名稱}

### 邊界條件
- [x] 資料量限制：{描述}
- [x] 同時操作：{描述}

---

## POC 驗證模式

**Level**: {S/M/L}

---

**藍圖狀態**: [~] ACTIVE
