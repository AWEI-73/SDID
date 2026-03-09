# 📋 {專案名稱} - 活藍圖 (Living Blueprint)

**迭代**: iter-1
**日期**: {YYYY-MM-DD}
**藍圖狀態**: [~] ACTIVE
**規模**: {S/M/L}
**方法論**: SDID v2.3

<!--
  活藍圖 (Living Blueprint) 說明：
  - 本文件是「主藍圖」，記錄所有 iter 的全局規劃
  - 每次 BUILD 完成後，更新迭代規劃表的狀態標記
  - 新 session 執行 BLUEPRINT-CONTINUE 時，直接讀此文件展開下一個 [STUB]
  - 不要在 iter-N (N>1) 的 draft 重複定義實體或共用模組

  狀態流轉：
    [STUB] → (BLUEPRINT-CONTINUE 展開) → [CURRENT] → (BUILD 完成) → [DONE]
-->

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
- [x] API 介面契約 (IXxxService interface — 定義形狀，不含實作)
- [x] 前端主入口殼 (AppRouter / Layout — npm run dev 可見首頁框架)
- [ ] 通用 UI 元件 (表單、表格、通知)

**樣式策略**: CSS Modules (.module.css)

<!--
  樣式策略說明（專案級別決策，所有 UI/ROUTE 動作共用）：
  - CSS Modules (.module.css): 推薦，每個元件一個 .module.css，自動 scope
  - Tailwind CSS: 適合快速原型，class-based
  - Global CSS: 簡單專案，全域 index.css / App.css
  - CSS-in-JS: styled-components / emotion，適合動態樣式
  
  plan-to-scaffold 會根據此欄位自動生成對應的 CSS 骨架檔。
  UI/ROUTE 類型的 .tsx 會自動帶 import styles from './xxx.module.css'。
-->

### 4. 獨立模組 (Modules)

#### 模組：{moduleA} ({中文名稱})
- layer: feature
- 依賴: [shared/types, shared/storage]
- 公開 API (index.ts):
  - {functionA}(args): ReturnType
  - {functionB}(args): ReturnType
- 獨立功能:
  - [x] {已確認的功能描述}
  - [ ] {待定的功能描述}

#### 模組：{moduleB} ({中文名稱})
- layer: feature
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

  ⚠ Iter 分層模型 (VSC-004，垂直切片原則):
  
  Foundation (Iter 1):
    - 型別 + 配置 + API 介面契約 (interface) + 前端主入口殼 (AppRouter/Layout)
    - 只放「形狀」(interface/type)，不放「行為」(實作/Mock)
    - ❌ 禁止在 Foundation 放 Mock Service、業務計算邏輯
    - Story-0: types/config, Story-1: API 介面 + 前端殼
  
  業務模組 (Iter 2+):
    - 一個 iter = 一個完整業務垂直切片（後端服務實作 → 前端串接）
    - 後端先行：先實作 SVC/API，再串接 UI/ROUTE
    - 同一個業務流程的後端和前端禁止拆到不同 iter
    - 如果動作數超過 Action Budget，拆成多個 Story（不是多個 iter）
    - Story-0: SVC/API 實作, Story-1: UI/ROUTE 串接
    - ❌ 反模式：iter-2 做 Mock，iter-3 才做 UI；每個 iter 只有 Story-0

  狀態: [CURRENT] 當前迭代 | [STUB] 待展開 | [DONE] 已完成

  **Blueprint Score 評分維度** (gate 執行後自動輸出，不擋但可見):
  - 垂直切片覆蓋 25分: 有前後端的 iter 數 / 非 Foundation iter 總數
  - Story 密度 20分: 非 Foundation iter 平均 story 數（目標 ≥2，只有 1 個扣分）
  - Flow 品質 20分: 有業務語意 flow 的動作比例
  - AC 覆蓋率 20分: P0/P1 動作有 AC 的比例
  - 基礎建設完整度 15分: Foundation 有型別/API介面/前端殼/樣式策略
  - 分級: 90+ EXCELLENT / 75-89 GOOD / 60-74 FAIR / 0-59 WEAK

  Action Budget 上限 (blueprint-gate BUDGET):
    每個 Story (模組) 建議最多 6 個動作 → WARN
    超過 10 個動作 → BLOCKER（需拆 Story）
    Foundation iter (全 CONST/LIB/SCRIPT/ROUTE) 豁免
    不再區分 Level S/M/L 的動作上限

  deps=[] 的模組可並行開發 (Multi-Agent Ready)
-->

| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別 + 配置 + API 介面契約 + 前端殼 | shared | INFRA | 無 | [CURRENT] |
| 2 | Core MVP | {完整業務流程: 後端服務→前端串接} | {moduleA} | FULL | shared | [STUB] |
| 3 | Extension | {完整業務流程: 後端服務→前端串接} | {moduleB} | FULL | shared, {moduleA} | [STUB] |

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
  v2.3 格式：動作清單攜帶 GEMS 標籤資訊 + 演化層標記 + AC 驗收條件編號

  欄位說明：
  - 業務語意: 用中文描述這個動作做什麼
  - 類型: CONST/LIB/API/SVC/HOOK/UI/ROUTE/SCRIPT
  - 技術名稱: 函式名或類型名 (對應 GEMS 標籤的函式名)
  - Signature: (param: Type) → ReturnType，agent 生成骨架時直接照抄
    CONST/UI/ROUTE 填 N/A
  - P: 優先級 P0-P3
  - 流向: STEP1→STEP2→STEP3 (對應 GEMS-FLOW，3-7 步)
  - 前端類型 (UI/HOOK/ROUTE) 的流向必須描述業務行為，不是 React 機制
  - 參考: action-type-mapping.md「前端類型 FLOW 詞彙」表
  - 依賴: [Type.Name] 格式 (對應 GEMS-DEPS)
  - 狀態: ○○ (未開始) | ✓✓ (完成)
  - 演化: BASE / L1 / L2 ... (v2.1 新增，標記此動作屬於哪個演化層)
  - AC: 驗收條件編號 (v2.2 新增，對應下方「驗收條件」區塊的 AC-X.Y)
       P0/P1 必填，P2/P3 選填。格式: AC-1.0 / AC-1.1 / AC-1.2 ...

  動作類型:
  - New: 全新函式
  - Modify: 修改既有函式 (加參數/改邏輯，v2.1 新增)

  優先級定義 (業務重要性，與測試策略無關):
  - P0: 核心流程，Gate 必須驗收 (AC 必填)
  - P1: 主要功能，整合依賴較多 (AC 必填)
  - P2: 輔助功能，獨立可運作 (AC 選填)
  - P3: 工具/格式化，低風險 (AC 選填)

  測試策略推導 (由 draft-to-plan 機械執行，不需手填):
  v2.3 起測試策略從「P 決定」改為「GEMS-FLOW + GEMS-DEPS 機械推導」

  條件 C (最優先): 流向含 SHEET/GAS/FETCH/DOM → poc-html (人工 POC 驗收)
  條件 A: 流向含 CALC/PARSE/FORMAT/CONVERT/DATE/ROC
    + 有 AC 驗收條件 → ac-runner (contract 鎖定期望值，Phase 5 機械驗證)
    + 無 AC          → jest-unit
  條件 B: 有外部依賴 且 DEPS-RISK >= MEDIUM → jest-integ
  其他: skip (不需要測試)

  AC 欄位說明 (v2.2):
  - 純計算函式 (條件 A): 必填，格式 AC-X.Y，對應下方「驗收條件」I/O 對
  - 外部資源函式 (條件 C): 填 poc (對應 POC.HTML 人工確認)
  - 其他: 選填或填 -
-->

### Iter 1: shared [CURRENT]

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | 操作 | 狀態 | 演化 | AC |
|---------|------|---------|-----------|---|------|------|------|------|------|----|
| 核心型別定義 | CONST | CoreTypes | N/A | P0 | DEFINE→FREEZE→EXPORT | 無 | NEW | ○○ | BASE | AC-0.0 |
| 環境變數管理 | CONST | ENV_CONFIG | N/A | P2 | LOAD→VALIDATE→EXPORT | 無 | NEW | ○○ | BASE | - |
| API 介面契約 | CONST | IServiceContracts | N/A | P1 | DEFINE→VALIDATE→EXPORT | [Internal.CoreTypes] | NEW | ○○ | BASE | AC-0.1 |
| 前端主入口殼 | ROUTE | AppRouter | N/A | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [Internal.CoreTypes] | NEW | ○○ | BASE | AC-0.2 |

### Iter 2: {moduleA} [STUB]

> {模組描述}，依賴 shared
> Story 拆法: Story-0 後端 (SVC/API), Story-1 前端串接 (UI/ROUTE)

**函式 Flow 清單** (expand 時直接搬運):

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | AC |
|---------|------|---------|-----------|---|------|------|----|
| {functionA 業務描述} | SVC | {functionA} | ({param}: {Type}) → {ReturnType} | P0 | {STEP1→STEP2→STEP3→RETURN} | [shared/types] | AC-1.0 |
| {functionB 業務描述} | SVC | {functionB} | ({param}: {Type}) → {ReturnType} | P1 | {STEP1→STEP2→RETURN} | [Internal.{functionA}] | AC-1.1 |
| {UI 元件描述} | UI | {ModuleView} | N/A | P1 | FETCH_DATA→RENDER→BIND_EVENTS | [Internal.{functionA}] | AC-1.2 |
| {路由描述} | ROUTE | {ModulePage} | N/A | P1 | CHECK_AUTH→LOAD_DATA→RENDER_LAYOUT | [Internal.{ModuleView}] | AC-1.3 |

**驗收條件骨架**:

**AC-1.0** — {functionA} 核心邏輯
- Given: {前置狀態，例如: 空的 DataStore / 已有 N 筆資料}
- When: 呼叫 `{functionA}({ {param}: '{testValue}' })`
- Then: 回傳值包含 `{關鍵欄位}` 為 `'{預期值}'`
- And: 呼叫 `{查詢函式}()` 返回 1 筆資料

**AC-1.1** — {functionB} 過濾/變更
- Given: 已存在 `{條件A}` 的資料 2 筆，`{條件B}` 的資料 1 筆
- When: 呼叫 `{functionB}('{過濾值}')`
- Then: 只返回符合 `{條件A}` 的 2 筆，不包含 `{條件B}` 的資料

### Iter 3: {moduleB} [STUB]

> {模組描述}，依賴 shared + {moduleA}
> Story 拆法: Story-0 後端 (SVC/API), Story-1 前端串接 (UI/ROUTE)

**函式 Flow 清單** (expand 時直接搬運):

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | AC |
|---------|------|---------|-----------|---|------|------|----|
| {functionC 業務描述} | SVC | {functionC} | ({param}: {Type}) → {ReturnType} | P0 | {STEP1→STEP2→STEP3→RETURN} | [shared/types, {moduleA}.{functionA}] | AC-2.0 |
| {UI 元件描述} | UI | {ModuleBView} | N/A | P1 | FETCH_DATA→RENDER→BIND_EVENTS | [Internal.{functionC}] | AC-2.1 |

**驗收條件骨架**:

**AC-2.0** — {functionC} 跨模組整合
- Given: {moduleA} 已有資料（依賴前一個 iter 的函式）
- When: 呼叫 `{functionC}({ {param}: '{testValue}' })`
- Then: 回傳值正確整合 `{moduleA}` 的資料
- And: `{關鍵欄位}` 為 `'{預期值}'`

---

## ✅ 驗收條件 (Acceptance Criteria)

<!--
  v2.3 新增：每個 P0/P1 動作必須有對應的 AC 條目。
  格式: AC-{iterNum}.{index}，從 0 開始。
  Given/When/Then 對應 BDD 風格，draft-to-plan 轉換時直接帶入 implementation_plan。

  規則:
  - P0/P1 動作必須有 AC（Gate 規則 ACC-001）
  - P2/P3 動作可選填（填了更好）
  - 每個 AC 只描述一個可驗證的行為

  AC block 格式（v2.3）:
  ┌─────────────────────────────────────────────────────────┐
  │ DOMAIN — Cynefin 域                                     │
  │   Clear      = 因果明確，照 Happy Path 做               │
  │   Complicated = 有邊界條件，agent 必須看 Edge           │
  │   Complex    = 有不確定性，agent 不可腦補               │
  │                                                         │
  │ ERROR_RETURNS — 可能拋出的 error type（統一命名）       │
  │   純 CONST/ROUTE 填 N/A                                 │
  │                                                         │
  │ Happy Path — 正常流程                                   │
  │ Edge       — 合法但特殊輸入（空陣列、零值、最大值）     │
  │ Failure    — 非法輸入或外部依賴失敗 → 拋錯或錯誤狀態   │
  └─────────────────────────────────────────────────────────┘

  Then 格式規則（效益導向）:
  ✅ 有效: 回傳 {具體值}，使用者因此能夠 {下一步行為}
  ✅ 有效: throw {ErrorType}('{訊息}')
  ❌ 無效: 系統處理完成
  ❌ 無效: 路由接線完成

  純計算類 AC 落地規則（v2.3）:
  - 流向含 CALC/PARSE/FORMAT/CONVERT/DATE/ROC 的函式（條件 A）
  - 除在此處寫 Given/When/Then 外，必須在 contract_iter-N.ts 補 @GEMS-AC 標籤
  - Phase 5 的 ac-runner 會讀 contract 的 @GEMS-AC，機械執行並比對 expect

  contract_iter-N.ts 的 @GEMS-AC 格式:
  // @GEMS-AC: AC-1.0
  // @GEMS-AC-FN: functionName
  // @GEMS-AC-MODULE: modules/ModuleName/lib/function-name
  // @GEMS-AC-INPUT: [arg1, arg2]
  // @GEMS-AC-EXPECT: { key: "value" }

  UI/Hook/GAS 類 AC：繼續用 Given/When/Then，靠人工 POC 驗收，不寫 @GEMS-AC
-->

### Iter 1: shared

**AC-0.0** — CoreTypes 型別定義
DOMAIN: Clear | ERROR_RETURNS: N/A
- Happy Path:
  - Given: 專案已初始化，包含 TypeScript 設定
  - When: 執行 `tsc --noEmit` 編譯
  - Then: 編譯成功，無 TypeScript 錯誤，所有核心型別可正常 import
- Edge:
  - When: 只 import 部分型別
  - Then: 其餘型別不受影響，tree-shaking 正常

**AC-0.1** — API 介面契約
DOMAIN: Clear | ERROR_RETURNS: N/A
- Happy Path:
  - Given: IServiceContracts 已定義
  - When: 實作類別 `implements IXxxService`
  - Then: TypeScript 強制要求實作所有方法簽名
- Failure:
  - When: 缺少任何方法
  - Then: TypeScript 編譯報錯，不可 build

**AC-0.2** — 前端主入口殼
DOMAIN: Clear | ERROR_RETURNS: N/A
- Happy Path:
  - Given: `npm run dev` 啟動
  - When: 瀏覽器開啟 localhost
  - Then: 首頁框架可見（Header + 主內容區 + 導覽），無 console error
- Failure:
  - Given: 子元件拋出 runtime error
  - When: 任意頁面渲染失敗
  - Then: ErrorBoundary 捕捉，顯示 fallback UI，不白屏

### Iter 2: {moduleA}

**AC-1.0** — {functionA} 核心業務邏輯
DOMAIN: {Clear | Complicated | Complex} | ERROR_RETURNS: {ErrorTypeA} | {ErrorTypeB}
> 🔧 純計算函式 → 需在 contract_iter-N.ts 補 @GEMS-AC 標籤（格式見上方說明）
- Happy Path:
  - Given: {前置狀態，例如: DataStore 中無資料 / 使用者已登入}
  - When: 呼叫 `{functionA}({ {必要參數}: '{測試值}' })`
  - Then: 回傳值包含 `id`（非空字串）且 `{關鍵欄位}` 為 `'{預期值}'`
- Edge:
  - Given: {邊界情境，如空陣列輸入、零值}
  - When: 呼叫 `{functionA}({邊界值})`
  - Then: {預期行為，不拋錯，回傳合理預設值}
- Failure:
  - Given: {非法輸入，如 null 或負數}
  - When: 呼叫 `{functionA}(null)`
  - Then: throw {ErrorTypeA}('{錯誤訊息}')

**AC-1.1** — {functionB} 狀態變更
DOMAIN: {Clear | Complicated} | ERROR_RETURNS: {ErrorTypeA}
- Happy Path:
  - Given: 已存在一筆 `{狀態欄位}='{初始狀態}'` 的資料（id = testId）
  - When: 呼叫 `{functionB}(testId)`
  - Then: `{狀態欄位}` 變為 `'{預期狀態}'`，其他欄位不受影響
- Failure:
  - Given: testId 不存在
  - When: 呼叫 `{functionB}('non-existent-id')`
  - Then: throw {ErrorTypeA}('找不到資料')

**AC-1.2** — {ModuleView} 渲染與互動
DOMAIN: Complicated | ERROR_RETURNS: N/A
- Happy Path:
  - Given: DataStore 中有 2 筆 `{過濾條件}` 的資料
  - When: 渲染 `<{ModuleView} {prop}="{值}" />`
  - Then: 畫面顯示 2 筆資料卡片，使用者可立即進行操作
- Edge:
  - Given: 資料為空陣列
  - When: 渲染元件
  - Then: 顯示空狀態提示，不崩潰
- Failure:
  - Given: 資料載入失敗
  - When: 渲染元件
  - Then: 顯示錯誤提示文字，提供重試按鈕

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
