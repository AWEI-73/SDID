# 📐 SDID 藍圖格式規格書 (Blueprint Format Specification)

**版本**: 1.0  
**日期**: 2026-02-08  
**方法論**: SDID (Semantic-Driven Iterative Development) — 語意驅動迭代開發  
**狀態**: 🟢 定案

---

## 1. 核心定位

### 1.1 什麼是 SDID？

SDID 是一套以「語意精確度」驅動開發品質的方法論：

```
小步快跑 → 逐步迭代 → 不求一次到位 → 每次穩定產出
```

**核心循環**:
```
PRD/需求描述 → Chatbot 對話 → Enhanced Draft → POC → PLAN → BUILD → SCAN → 下一迭代
                    ↑                                                          │
                    └──────────── iteration_suggestions ────────────────────────┘
```

### 1.2 藍圖 ≠ 產品生成器

藍圖是**驗證基線 (Validation Baseline)**，不是自動產品生成器：

| 藍圖的角色 | 說明 |
|-----------|------|
| ✅ 驗證基線 | 給 POC/PLAN/BUILD 門控提供精確的比對依據 |
| ✅ 語意地圖 | 讓 AI 知道「做什麼、為什麼、怎麼做」 |
| ✅ 並行基礎 | `deps=[]` 的模組可由不同 Agent 同時開發 |
| ❌ 不是代碼生成器 | 不會直接產出程式碼 |
| ❌ 不是完美規格 | 允許漸進填充 (stub → partial → full) |

### 1.3 為什麼不用 JSON？

| 方案 | 問題 |
|------|------|
| JSON 藍圖 | AI 大型輸出容易截斷、格式錯誤、難以人工編輯 |
| @BP:SET 指令組裝 | 過度工程化，增加學習成本 |
| **Enhanced Draft (Markdown)** ✅ | 人類可讀、AI 可寫、現有流程零改動 |

---

## 2. Enhanced Draft 格式定義

Enhanced Draft 是一份**結構化的 requirement_draft**，比普通 draft 多了三個關鍵區塊：
- **實體表格** (Entity Tables)
- **迭代規劃表** (Iteration Planning)
- **模組動作清單** (Module Action Lists)

### 2.1 完整模板

```markdown
# 📋 {專案名稱} - 需求草稿 (Enhanced Blueprint Draft)

**迭代**: iter-1  
**日期**: {YYYY-MM-DD}  
**狀態**: 🔄 待驗證  
**規模**: {S/M/L}  
**方法論**: SDID v1.0

---

## 用戶原始需求

> {貼上原始 PRD 或需求描述，至少 50 字}

---

## 一句話目標

{用一句話描述 MVP 要達成什麼}

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
| status | enum | 'DRAFT'\|'ACTIVE' | 狀態 |
| createdAt | Date | NOT NULL | 建立時間 |

#### {EntityB}
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| entityAId | string | FK → EntityA.id | 關聯 |

### 3. 共用模組 (Shared)

- [x] 基礎建設 (types, config, constants)
- [ ] {共用 CRUD 邏輯}
- [ ] {共用 UI 元件}

### 4. 獨立模組 (Modules)

#### 模組：{ModuleA}
- 依賴: [shared/types, shared/config]
- 獨立功能:
  - [ ] {功能描述}
  - [ ] {功能描述}

#### 模組：{ModuleB}
- 依賴: [shared/types, ModuleA (可選)]
- 獨立功能:
  - [ ] {功能描述}

### 5. 路由結構

```
main.ts
└── router.ts
    ├── /shared/* → 共用
    ├── /{moduleA}/* → 模組A
    └── /{moduleB}/* → 模組B
```

---

## 📅 迭代規劃表 (Iteration Planning)

| Iter | 範圍 | 目標 | 模組 | 依賴 |
|------|------|------|------|------|
| 1 | Foundation | 基礎建設 + 型別 + 配置 | shared | 無 |
| 2 | Core MVP | 核心業務模組 | {ModuleA} | shared |
| 3 | Extension | 擴展功能 | {ModuleB} | shared, {ModuleA} |

> deps=[] 的模組可並行開發 (Multi-Agent Ready)

---

## 📋 模組動作清單 (Module Actions)

### Iter 1: shared

| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
|---------|------|---------|--------|------|
| 環境變數管理 | CONST | ENV_CONFIG | P2 | LOAD → VALIDATE → EXPORT |
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE → FREEZE → EXPORT |
| 儲存層封裝 | LIB | storage | P1 | INIT → CRUD_OPS → EXPORT |

### Iter 2: {ModuleA}

| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
|---------|------|---------|--------|------|
| {業務動作} | API/SVC/HOOK/UI | {techName} | P0-P3 | {STEP1 → STEP2 → STEP3} |

---

## 功能模組清單

- [x] 基礎建設 (types, config)
- [x] {ModuleA 核心功能}
- [ ] {ModuleB 擴展功能}

### 不做什麼

- {明確排除項目}
- {明確排除項目}

---

## 釐清項目

### 使用者角色
- [x] 主要使用者：{描述}

### 核心目標
- [x] 解決問題：{描述}
- [x] 預期效益：{描述}

### 資料結構
- [x] 核心實體：{參照上方實體定義}

### 邊界條件
- [x] 資料量限制：{描述}

---

## POC 驗證模式

**Level**: {S/M/L}

---

**草稿狀態**: [~] PENDING
```

---

## 3. 三大增強區塊詳解

### 3.1 實體表格 (Entity Tables)

**目的**: 讓 POC Step 3 (契約設計) 能直接衍生 `@GEMS-CONTRACT`

```markdown
#### Product
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| name | string | NOT NULL, VARCHAR(100) | 產品名稱 |
| price | number | NOT NULL, >= 0 | 價格 |
| categoryId | string | FK → Category.id | 分類關聯 |
| status | enum | 'DRAFT'\|'ACTIVE'\|'ARCHIVED' | 狀態 |
```

**POC Step 3 衍生結果**:
```typescript
// @GEMS-CONTRACT: Product
// @GEMS-TABLE: tbl_products
interface Product {
  id: string;           // UUID, PK
  name: string;         // VARCHAR(100), NOT NULL
  price: number;        // DECIMAL(10,2), NOT NULL, >= 0
  categoryId: string;   // FK → Category.id
  status: ProductStatus; // ENUM('DRAFT','ACTIVE','ARCHIVED')
}
```

### 3.2 迭代規劃表 (Iteration Planning)

**目的**: 定義模組開發順序與依賴關係，支援 Multi-Agent 並行

```markdown
| Iter | 範圍 | 目標 | 模組 | 依賴 |
|------|------|------|------|------|
| 1 | Foundation | 型別 + 配置 + 儲存層 | shared | 無 |
| 2 | Core | 產品管理 CRUD | products | shared |
| 2 | Core | 分類管理 CRUD | categories | shared |
| 3 | Integration | 報表與統計 | reports | shared, products, categories |
```

**並行判斷規則**:
- 同一 Iter 內、`依賴` 欄位不互相引用的模組 → 可並行
- 上例中 `products` 和 `categories` 都只依賴 `shared` → ✅ 可並行

### 3.3 模組動作清單 (Module Actions)

**目的**: 讓 PLAN Step 2 能精確產出 `implementation_plan`，讓 BUILD Phase 2 能精確注入 GEMS 標籤

```markdown
| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
|---------|------|---------|--------|------|
| 產品列表獲取 | API | getProductList | P0 | FETCH → VALIDATE → RETURN_DTO |
| 產品資料轉換 | SVC | formatProduct | P1 | RECV_DTO → MAP_MODEL → EXPORT |
| 新增產品 | API | createProduct | P0 | VALIDATE → PERSIST → RETURN |
| 產品互動邏輯 | HOOK | useProducts | P1 | CALL_API → UPDATE_STATE → RENDER |
```

**類型定義**:

| 類型 | 說明 | 典型場景 |
|------|------|---------|
| CONST | 常數/配置 | 環境變數、權限定義 |
| LIB | 工具封裝 | HTTP Client、日期工具 |
| API | API 串接 | HTTP 請求、DTO 接收 |
| SVC | 業務服務 | 資料轉換、計算邏輯 |
| HOOK | 互動邏輯 | React Hook、狀態管理 |
| UI | 介面元件 | 頁面、元件 |
| ROUTE | 路由 | 動態路由、守衛 |
| SCRIPT | 腳本 | 部署、建置 |

---

## 4. Chatbot 藍圖架構師 (Blueprint Architect)

### 4.1 角色定義

Chatbot 是一個**引導式對話機器人**，透過結構化問答將使用者的模糊需求轉化為 Enhanced Draft。

```
使用者: "我想做一個碳盤查系統"
    ↓
Chatbot: 引導 5 輪對話
    ↓
產出: requirement_draft_iter-1.md (Enhanced)
    ↓
放入: .gems/iterations/iter-1/poc/
    ↓
Task-Pipe: POC → PLAN → BUILD → SCAN (照常執行)
```

### 4.2 對話流程 (5 輪)

```
Round 1: 目標釐清
  "這個系統要解決什麼問題？誰會用？"
  → 產出: 一句話目標 + 族群識別

Round 2: 實體識別
  "系統需要管理哪些資料？每筆資料有什麼欄位？"
  → 產出: 實體表格

Round 3: 模組拆分
  "哪些功能是所有人都用的？哪些是特定角色專屬的？"
  → 產出: 共用模組 + 獨立模組 + 路由結構

Round 4: 迭代規劃
  "第一版 MVP 要做到什麼程度？哪些可以後面再做？"
  → 產出: 迭代規劃表 + 不做什麼

Round 5: 動作細化
  "每個模組具體要做哪些操作？資料怎麼流動？"
  → 產出: 模組動作清單
```

### 4.3 Chatbot System Prompt

完整的 System Prompt 定義在 `task-pipe/tools/blueprint-architect.cjs` 的 `SYSTEM_PROMPT` 常數中。

取得方式：
```bash
# CLI 輸出
node task-pipe/tools/blueprint-architect.cjs --prompt

# 程式碼引用
const { SYSTEM_PROMPT } = require('./blueprint-architect.cjs');
```

Prompt 包含：
- 5 輪對話流程 (目標釐清 → 實體識別 → 模組拆分 → 迭代規劃 → 動作細化)
- 模組化架構概念 (6 層橫向分層 + 垂直分片 + 依賴規則)
- 動作類型 → 模組目錄映射表
- 關鍵開發規則 (API/Service 分離、DTO vs Model、Hooks 優先)
- 濃縮版 EcoTrack 範例
- 產出路徑指引 (`{專案}/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md`)

---

## 5. POC 流程整合

### 5.1 Enhanced Draft 如何餵入現有流程

```
Enhanced Draft (放入 .gems/iterations/iter-1/poc/)
    │
    ▼
POC Step 1 (模糊消除) ← 現有 checkDraft() 驗證
    │                     實體表格、迭代規劃表、動作清單
    │                     讓驗證更容易通過 (內容更完整)
    ▼
POC Step 2 (規模評估) ← 從迭代規劃表直接讀取規模
    │
    ▼
POC Step 3 (契約設計) ← 從實體表格直接衍生 @GEMS-CONTRACT
    │                     精確度大幅提升
    ▼
POC Step 4 (UI 原型)  ← 從模組動作清單知道要做哪些 UI
    │
    ▼
POC Step 5 (需求規格) ← 從迭代規劃表 + 動作清單
    │                     產出更精確的 requirement_spec
    ▼
PLAN → BUILD → SCAN (照常)
```

### 5.2 向後相容

Enhanced Draft 是普通 draft 的**超集**：
- 普通 draft 缺少實體表格、迭代規劃表、動作清單 → POC 照常運作 (AI 自行推導)
- Enhanced Draft 有這些區塊 → POC 更精確、更少模糊消除來回

**不需要修改任何現有腳本**。現有的 `checkDraft()` 已經能驗證 Enhanced Draft，因為它檢查的是基礎結構 (族群、共用模組、獨立模組、路由、功能清單)。

### 5.3 blueprint-specPOC.html 的角色

POC HTML 作為**視覺確認工具**：
- 使用者可以將 Enhanced Draft 的動作清單匯入 POC HTML 查看
- POC HTML 的 `specData` 格式與動作清單表格一一對應
- 但 POC HTML 不是資料來源，Enhanced Draft 才是

---

## 6. 漸進填充 (Progressive Filling)

大型專案不需要一次填完所有細節：

| 填充等級 | 說明 | 適用場景 |
|---------|------|---------|
| **Stub** | 只有模組名稱和大致描述 | 初期探索、不確定的模組 |
| **Partial** | 有實體表格但動作清單不完整 | 確定資料結構但功能待定 |
| **Full** | 所有區塊都填完 | 明確的模組，準備進入開發 |

```markdown
### Iter 3: reports (Stub)
> 報表與統計模組，具體功能待 Iter 2 完成後再定義

### Iter 2: products (Full)
| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
|---------|------|---------|--------|------|
| 產品列表 | API | getProducts | P0 | FETCH → DTO → RETURN |
| 新增產品 | API | createProduct | P0 | VALIDATE → PERSIST → RETURN |
| 產品轉換 | SVC | formatProduct | P1 | DTO → MODEL → EXPORT |
```

Stub 模組在進入該 Iter 時，由 Chatbot 或 AI 補充為 Full。

---

## 7. Multi-Agent 並行開發

### 7.1 獨立性判斷

從迭代規劃表的 `依賴` 欄位判斷：

```markdown
| Iter | 模組 | 依賴 |
|------|------|------|
| 2 | products | shared |
| 2 | categories | shared |
| 3 | reports | shared, products, categories |
```

- `products` 和 `categories` 依賴相同 (`shared`)，互不依賴 → ✅ 可並行
- `reports` 依賴 `products` 和 `categories` → ❌ 必須等 Iter 2 完成

### 7.2 Agent 分配

```
Agent A: shared (Iter 1)
    ↓ 完成
Agent A: products (Iter 2)  ←── 並行 ──→  Agent B: categories (Iter 2)
    ↓ 都完成
Agent A: reports (Iter 3)
```

每個 Agent 獨立執行 POC → PLAN → BUILD → SCAN，互不干擾。

---

## 8. 驗證規則

### 8.1 Enhanced Draft 驗證清單

| 檢查項 | 必要性 | 說明 |
|--------|--------|------|
| 一句話目標 | 必要 | ≥ 10 字，無佔位符 |
| 族群識別表 | 必要 | ≥ 1 個真實族群 |
| 實體表格 | 建議 | 有則 Step 3 更精確 |
| 共用模組 | 必要 | ≥ 1 個勾選 |
| 獨立模組 | 必要 | ≥ 1 個真實模組名 |
| 路由結構 | 必要 | 有 main + router |
| 迭代規劃表 | 建議 | 有則 Step 2 更精確 |
| 模組動作清單 | 建議 | 有則 PLAN 更精確 |
| 功能模組清單 | 必要 | ≥ 2 個勾選 |
| POC Level | 必要 | S/M/L |

「建議」項目缺少時不會 BLOCKER，但 AI 需要自行推導（精確度降低）。

### 8.2 現有 checkDraft() 相容性

現有的 `checkDraft()` 函式已涵蓋「必要」項目的驗證。  
「建議」項目不需要額外驗證腳本 — 它們的存在自然提升 AI 推導精確度。

---

## 9. 實例：EcoTrack 碳盤查系統

以下展示如何將 PRD 轉為 Enhanced Draft：


```markdown
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
```

---

## 10. 總結

| 項目 | 說明 |
|------|------|
| **格式** | Enhanced Markdown Draft (普通 draft 的超集) |
| **產出者** | Chatbot 藍圖架構師 (5 輪對話) 或人工撰寫 |
| **消費者** | 現有 POC → PLAN → BUILD → SCAN 流程 |
| **改動量** | 零 — 不需修改任何現有腳本 |
| **並行支援** | 迭代規劃表的 deps 欄位判斷獨立性 |
| **漸進填充** | Stub → Partial → Full，大型專案不需一次到位 |
| **向後相容** | 普通 draft 照常運作，Enhanced Draft 只是更精確 |

---

*SDID v1.0 | Task-Pipe Framework | 2026-02-08*
