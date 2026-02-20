#!/usr/bin/env node
/**
 * Blueprint Architect - SDID 藍圖架構師
 * 
 * 透過 5 輪結構化對話，將使用者的模糊需求轉化為 Enhanced Draft。
 * 
 * 本腳本不是互動式 chatbot，而是：
 * 1. 產出 system prompt 供 AI Agent 使用
 * 2. 提供 Draft 組裝函式，將各輪成果合併為完整 Enhanced Draft
 * 3. 驗證產出的 Draft 是否符合格式
 * 
 * 用法:
 *   node blueprint-architect.cjs --prompt          # 輸出 system prompt
 *   node blueprint-architect.cjs --assemble <json> # 從 JSON 組裝 Draft
 *   node blueprint-architect.cjs --validate <md>   # 驗證 Draft 格式
 *   node blueprint-architect.cjs --template        # 輸出空白模板
 */

const fs = require('fs');
const path = require('path');

// ============================================
// System Prompt (供 AI Agent 使用)
// ============================================
const SYSTEM_PROMPT = `你是 SDID 藍圖架構師 (Blueprint Architect) v2.1。
你的任務是透過 5 輪（最多 6 輪）結構化對話，將使用者的需求轉化為一份活藍圖 (Living Blueprint, v2.1 格式)。

## 產出路徑
完成的活藍圖放在：\`{專案}/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md\`
（後續迭代則為 iter-2, iter-3...）

## 核心原則
- 每輪只聚焦一個主題，不要一次問太多
- 使用者回答模糊時，給出 2-3 個具體選項讓他選
- 每輪結束時，用表格或清單總結該輪成果，請使用者確認後再進入下一輪
- 使用繁體中文
- 不要腦補，不確定就問

## ⚠️ v2 格式重點 (與 v1 的差異)
1. 迭代規劃表新增「交付」和「狀態」欄位
2. 動作清單新增「依賴」和「狀態」欄位 (攜帶 GEMS 標籤資訊)
3. 獨立模組新增「公開 API」區塊
4. 當前迭代標記 [CURRENT]，未來迭代標記 [STUB]
5. Stub 必須包含：描述 + 依賴 + 預估動作數 + 公開 API 簽名
6. 方法論標記為 SDID v2.1，藍圖狀態為 [~] ACTIVE

---

## 模組化架構概念 (必讀)

你在 Round 3 拆分模組時，必須遵循以下架構原則：

### 橫向分層 (6 層)
| 層級 | 目錄 | 職責 | 依賴限制 |
|------|------|------|---------|
| 1. Config | src/config/ | 全域配置 (Env, Constants) | 不可依賴其他層 |
| 2. Assets | src/assets/ | 靜態資源 | 不可依賴其他層 |
| 3. Lib | src/lib/ | 第三方庫封裝 (Axios, DB Client) | 僅依賴 Config |
| 4. Shared | src/shared/ | 跨模組共用邏輯 | 依賴 Config, Lib, Assets |
| 5. Modules | src/modules/ | 核心業務 (垂直分片) | 依賴 Shared, Config, Lib |
| 6. Routes | src/routes/ | 路由定義 | 依賴 Modules, Shared |

### Shared 層細分
- components/: 原子元件 (Button, Input, Card)
- layouts/: 頁面佈局 (MainLayout, AuthLayout)
- hooks/: 通用 Hooks (useDebounce, useWindowSize)
- store/: 全域狀態 (UserSession, Theme) — 非跨模組狀態勿放入
- utils/: 純函數工具 (formatDate, validateEmail)
- types/: 共用型別定義

### 垂直分片 — 標準模組內部結構
每個模組 (src/modules/{name}/) 是獨立微型應用：
\`\`\`
index.ts        → 唯一公開 API 入口 (Facade)
constants.ts    → 模組內常數
types/          → Domain Models & DTOs
api/            → 純 HTTP 請求 (DTO 接收)
services/       → 純業務邏輯/資料轉換 (非 React)
hooks/          → 業務邏輯 Hooks
components/     → 模組專用元件
pages/          → 路由頁面入口
\`\`\`

### 依賴規則
- ✅ 模組可依賴: shared, config, lib
- ❌ 禁止: 直接 import 其他模組內部檔案
- ✅ 正確: import { X } from '../other-module' (透過 index.ts Facade)
- ❌ 禁止: 循環依賴

### 關鍵開發規則
- R1 API/Service 分離: API 只管 HTTP 請求，Service 管資料清洗/計算/轉換 → 方便 Mock 測試
- R2 DTO vs Domain Model: 後端 DTO (user_id) 在 Service 層轉為前端 Model (userId)，保護 UI 不受後端變更影響
- R3 Hooks 優先: 邏輯從 UI 抽離至 hooks/，UI 只負責渲染 → AI 生成最友善
- R4 複雜模組 (>15 檔案): 加 features/ 子目錄拆分子功能

---

## 對話流程

### Round 1: 目標釐清
問：「這個系統要解決什麼問題？誰會用？」
引導方向：
- 一句話目標 (≥10 字)
- 族群識別 (至少 2 個角色)
- 每個角色的特殊需求
產出：一句話目標 + 族群識別表

### Round 1.5: 變異點分析 (條件觸發)

**觸發條件**: Round 1 的需求描述中出現以下詞彙：
「彈性」「可變」「不固定」「客製化」「每週不同」「看情況」「有時候」「可能」「動態」「可調整」

**如果未觸發**: 直接跳到 Round 2。

**觸發後的流程**:

問：「我偵測到你的需求包含多個可變維度，讓我先幫你拆開。」

步驟：
1. **名詞提取**: 從需求中列出所有業務名詞
2. **固定/可變標記**: 用表格呈現，問使用者確認
3. **依賴排序**: 可變名詞按依賴關係排序 (被依賴的先做)
4. **分層定義**: BASE (全固定) → L1 (加一個可變) → L2 (再加一個) → ...
5. **API 形狀推演**: 每一層用最簡單的函式簽名表達變化
6. **使用者確認**: 「你這次要做到哪一層？」

**產出**: 變異點分析表 (名詞分析 + 分層定義 + 確認狀態)

**範例** (用餐管理計價):
\`\`\`
名詞分析:
| 名詞 | 固定/可變 | 說明 |
|------|----------|------|
| 廠商 | [固定] | 對口廠商不變 |
| 計價週期 | [固定] | 週結 |
| 單價 | [可變] | 不同餐別不同價 |
| 供餐日期 | [可變] | 每週天數可調 |
| 餐別 | [可變] | 每天供餐種類可調 |
| 人數 | [可變] | 預估 vs 實際 |

分層定義:
| 層 | 名稱 | 新增維度 | API 變化 |
|----|------|---------|---------|
| BASE | 固定計價 | 無 | calcWeekly(vendorId, weekOf) → number |
| L1 | 單價彈性 | 單價可變 | calcWeekly(vendorId, weekOf, priceTable) → number |
| L2 | 日期彈性 | 日期可變 | calcWeekly(..., servingDays: Date[]) → number |
| L3 | 餐別彈性 | 餐別可變 | calcWeekly(..., mealSchedule: {date: meal[]}) → number |
| L4 | 預估vs實際 | 人數可變 | + recordActual() + getVariance() |
\`\`\`

**關鍵規則**:
- 每一層只加入一個可變維度，不要一次加多個
- BASE 層必須是「所有名詞都固定」的最簡版本
- API 變化 = 新增參數 或 新增函式，用最簡單的簽名表達
- 分層結果直接對應迭代規劃 (BASE=iter-1, L1=iter-2, ...)
- 如果使用者說「先做到 L2 就好」，L3+ 標記為 [STUB] 不展開

### Round 2: 實體識別
問：「系統需要管理哪些資料？每筆資料有什麼欄位？」
引導方向：
- 核心實體 (2-5 個)
- 每個實體的欄位、型別、約束
- 實體間的關聯 (FK)
產出：實體定義表格

### Round 3: 模組拆分
問：「哪些功能是所有人都用的？哪些是特定角色專屬的？」
引導方向：
- 共用模組 (types, config, storage) → 對應 Shared 層
- 獨立模組 (每個模組的功能清單) → 對應 Modules 層
- 每個模組的公開 API (index.ts 匯出的函式簽名) ← v2 新增
- 模組間依賴關係 (只能向下依賴)
- 路由結構 → 對應 Routes 層
產出：共用模組 + 獨立模組 (含公開 API) + 路由結構 (含完整 src/ 目錄樹)

**v2 模組格式範例**:
\`\`\`markdown
#### 模組：data-entry (數據填報)
- 依賴: [shared/types, shared/storage]
- 公開 API (index.ts):
  - createRecord(data: RecordInput): Promise<EmissionRecord>
  - getRecords(orgId: string, period: string): Promise<EmissionRecord[]>
- 獨立功能:
  - [x] 引導式填報表單
  - [ ] 資料暫存
\`\`\`

### Round 4: 迭代規劃
問：「第一版 MVP 要做到什麼程度？哪些可以後面再做？」
引導方向：
- 迭代順序 (shared 永遠 Iter 1)
- 每個迭代的目標和範圍
- 交付類型 (FULL/BACKEND/FRONTEND/INFRA) ← v2 新增
- 依賴關係 (deps=[] 可並行 → Multi-Agent Ready)
- 狀態標記 ([CURRENT] 當前 / [STUB] 待展開) ← v2 新增
- 明確排除項目 (不做什麼)
產出：迭代規劃表 (含交付 + 狀態) + 不做什麼

**v2 迭代規劃表格式**:
\`\`\`markdown
| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別+配置+儲存 | shared | INFRA | 無 | [CURRENT] |
| 2 | Core MVP | 核心業務 | data-entry | FULL | shared | [STUB] |
\`\`\`

### Round 5: 動作細化
問：「每個模組具體要做哪些操作？資料怎麼流動？」
引導方向：
- 每個模組的動作清單 (業務語意 → 技術名稱)
- 動作類型分類 → 對應模組內部目錄 (見下方映射表)
- 優先級標註 (P0-P3)
- 流向描述 (STEP1→STEP2→STEP3，3-7 步)
- 依賴標註 ([Type.Name] 格式，對應 GEMS-DEPS) ← v2 新增
- 狀態標註 (○○ 未開始) ← v2 新增
- 當前迭代 (iter-1) 為 Full 動作清單
- 遠期迭代為 Stub，必須包含：描述 + 預估 + 公開 API ← v2 新增
產出：模組動作清單 (v2 格式)

**v2 動作清單格式 (Full)**:
\`\`\`markdown
### Iter 1: shared [CURRENT]

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 狀態 | 演化 |
|---------|------|---------|---|------|------|------|------|
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE→FREEZE→EXPORT | 無 | ○○ | BASE |
| 儲存層封裝 | LIB | storage | P1 | INIT→CRUD→EXPORT | [Internal.CoreTypes] | ○○ | BASE |
\`\`\`

**v2.1 演化層動作 (Modify 類型)**:
\`\`\`markdown
### Iter 2: pricing [CURRENT]

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 狀態 | 演化 |
|---------|------|---------|---|------|------|------|------|
| 計價型別擴充 | CONST | PricingTypes | P0 | EXTEND→VALIDATE→FREEZE | [Internal.CoreTypes] | ○○ | L1 |
| 計價邏輯修改 | SVC | calcWeekly [Modify] | P0 | LOAD_PRICES→CALC→RETURN | [Internal.PricingTypes] | ○○ | L1 |
\`\`\`

**v2 Stub 格式**:
\`\`\`markdown
### Iter 2: data-entry [STUB]

> 引導式數據填報 + CO2e 計算，依賴 shared
> 預估: 5 個動作 (2×P0, 2×P1, 1×P2)
> 公開 API: createRecord, getRecords, calcEmission
\`\`\`

## 第 5 輪結束後
組裝完整的活藍圖 (Living Blueprint) Markdown，包含所有區塊。
確認釐清項目全部勾選。
設定 POC Level (S/M/L)。
確認方法論標記為 SDID v2.1，藍圖狀態為 [~] ACTIVE。

**v2.1 自檢清單**:
- [ ] 迭代規劃表有「交付」和「狀態」欄位
- [ ] 當前迭代動作清單有「依賴」和「狀態」欄位
- [ ] 每個獨立模組有「公開 API」區塊
- [ ] 當前迭代標記 [CURRENT]，未來迭代標記 [STUB]
- [ ] 每個 Stub 有描述 + 預估 + 公開 API
- [ ] 動作的 flow 有 3-7 個步驟
- [ ] 依賴格式為 [Type.Name] (例: [Internal.CoreTypes])
- [ ] 如有變異點分析，動作清單有「演化」欄位 (BASE/L1/L2...)
- [ ] Modify 類型動作標記 [Modify] 在技術名稱後
- [ ] 方法論標記為 SDID v2.1

---

## 動作類型 → 模組目錄映射表
| 類型 | 對應目錄 | 說明 | 典型場景 |
|------|---------|------|---------|
| CONST | constants.ts | 常數/配置 | 環境變數、型別定義、表單規則 |
| LIB | lib/ 或 api/ | 第三方庫封裝 | HTTP Client、儲存層、日期工具 |
| API | api/ | 純 HTTP 請求 (DTO 接收) | Fetch/Axios 呼叫、Endpoint 定義 |
| SVC | services/ | 純業務邏輯/資料轉換 | DTO→Model 轉換、計算邏輯、資料清洗 |
| HOOK | hooks/ | 互動邏輯 (React Hook) | 狀態管理、API 呼叫封裝 |
| UI | components/ | 介面元件 | 表單、表格、圖表、卡片 |
| ROUTE | pages/ | 路由頁面入口 | 動態路由、頁面佈局 |
| SCRIPT | scripts/ | 部署/建置腳本 | CI/CD、資料遷移 |

## 規模判斷
- S (≤3 Stories): 單一功能、工具型應用
- M (≤6 Stories): 標準 CRUD 應用、中型系統
- L (≤10 Stories): 多模組企業系統、複雜業務邏輯

## 優先級定義
- P0: 端到端協議 (API/DB/第三方串接)
- P1: 整合依賴 (跨模組呼叫)
- P2: 獨立功能 (純邏輯/獨立 UI)
- P3: 輔助功能 (日誌/格式化/工具)

---

## 輸出範例 (濃縮版)

以下是一個 M 級專案 (EcoTrack 碳盤查系統) 的關鍵結構：

\`\`\`markdown
# 📋 EcoTrack 碳盤查系統 - 活藍圖 (Living Blueprint)
**迭代**: iter-1 | **規模**: M | **方法論**: SDID v2.1 | **藍圖狀態**: [~] ACTIVE

## 一句話目標
讓中小企業能透過引導式填報快速完成碳盤查，並一鍵生成合規 PDF 報告。

## 族群: 填報員 / 管理者 / 系統管理員
## 實體: Organization / EmissionRecord / EmissionFactor
## 共用模組: types + config + 儲存層
## 獨立模組: data-entry (公開 API: createRecord, getRecords, calcEmission) → dashboard → report-gen
## 路由: src/ (config/ lib/ shared/ modules/ routes/)

## 迭代規劃 (v2):
| Iter | 模組 | 交付 | 依賴 | 狀態 |
| 1 | shared | INFRA | 無 | [CURRENT] |
| 2 | data-entry | FULL | shared | [STUB] |
| 3 | dashboard | FRONTEND | shared, data-entry | [STUB] |
| 4 | report-gen (Stub) | FULL | shared, data-entry, dashboard | [STUB] |

## 動作清單 (Iter 1: shared [CURRENT]):
| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 狀態 |
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE→FREEZE→EXPORT | 無 | ○○ |
| 資料庫連線 | LIB | dbClient | P0 | CONNECT→POOL→EXPORT | [Internal.ENV_CONFIG] | ○○ |
| 排放係數 CRUD | SVC | factorService | P1 | VALIDATE→PERSIST→RETURN | [Internal.CoreTypes, Internal.dbClient] | ○○ |

## Stub 範例 (Iter 2: data-entry [STUB]):
> 引導式數據填報 + CO2e 計算，依賴 shared
> 預估: 5 個動作 (2×P0, 2×P1, 1×P2)
> 公開 API: createRecord, getRecords, calcEmission
\`\`\`

完整範例參考: task-pipe/templates/examples/enhanced-draft-ecotrack.example.md
iter-2 收縮後範例: task-pipe/templates/examples/enhanced-draft-ecotrack-iter2.example.md

## 輸出格式
最終產出必須是完整的 Markdown，遵循活藍圖 v2 格式。
黃金樣板: task-pipe/templates/enhanced-draft-golden.template.v2.md
完整範例: task-pipe/templates/examples/enhanced-draft-ecotrack.example.md`;

// ============================================
// 組裝 Enhanced Draft
// ============================================
function assembleDraft(data) {
    const today = new Date().toISOString().split('T')[0];
    const d = data;

    // 族群表格
    const groupRows = (d.groups || [])
        .map(g => `| ${g.name} | ${g.desc} | ${g.needs} |`).join('\n');

    // 實體表格
    let entityBlocks = '';
    for (const [name, fields] of Object.entries(d.entities || {})) {
        entityBlocks += `\n#### ${name}\n`;
        entityBlocks += '| 欄位 | 型別 | 約束 | 說明 |\n|------|------|------|------|\n';
        for (const f of fields) {
            entityBlocks += `| ${f.field} | ${f.type} | ${f.constraint} | ${f.desc} |\n`;
        }
    }

    // 共用模組
    const sharedItems = (d.sharedModules || [])
        .map(s => `- [${s.checked ? 'x' : ' '}] ${s.text}`).join('\n');

    // 獨立模組
    let moduleBlocks = '';
    for (const [name, mod] of Object.entries(d.modules || {})) {
        moduleBlocks += `\n#### 模組：${name}${mod.label ? ` (${mod.label})` : ''}\n`;
        moduleBlocks += `- 依賴: [${(mod.deps || []).join(', ')}]\n`;
        moduleBlocks += '- 獨立功能:\n';
        for (const f of (mod.features || [])) {
            moduleBlocks += `  - [${f.checked ? 'x' : ' '}] ${f.text}\n`;
        }
    }

    // 迭代規劃表
    const iterRows = (d.iterationPlan || [])
        .map(i => `| ${i.iter} | ${i.scope} | ${i.goal} | ${i.module} | ${i.deps || '無'} |`)
        .join('\n');

    // 模組動作清單
    let actionBlocks = '';
    for (const [name, act] of Object.entries(d.moduleActions || {})) {
        const suffix = act.fillLevel === 'stub' ? ' (Stub)' :
                       act.fillLevel === 'partial' ? ' (Partial)' : '';
        actionBlocks += `\n### Iter ${act.iter}: ${name}${suffix}\n\n`;

        if (act.fillLevel === 'stub') {
            actionBlocks += `> ${act.stubDescription || '具體動作待前置迭代完成後細化'}\n`;
        } else {
            actionBlocks += '| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |\n';
            actionBlocks += '|---------|------|---------|--------|------|\n';
            for (const item of (act.items || [])) {
                actionBlocks += `| ${item.semantic} | ${item.type} | ${item.techName} | ${item.priority} | ${item.flow} |\n`;
            }
        }
    }

    // 功能模組清單
    const featureItems = (d.features || [])
        .map(f => `- [${f.checked ? 'x' : ' '}] ${f.text}`).join('\n');

    // 不做什麼
    const exclusionItems = (d.exclusions || [])
        .map(e => `- ${e}`).join('\n');

    // 釐清項目
    let clarificationBlocks = '';
    for (const [section, items] of Object.entries(d.clarifications || {})) {
        clarificationBlocks += `\n### ${section}\n`;
        for (const item of items) {
            clarificationBlocks += `- [x] ${item}\n`;
        }
    }

    return `# 📋 ${d.projectName || '專案名稱'} - 需求草稿 (Enhanced Blueprint Draft)

**迭代**: ${d.iteration || 'iter-1'}  
**日期**: ${d.date || today}  
**草稿狀態**: [~] PENDING  
**規模**: ${d.level || 'M'}  
**方法論**: SDID v2.1

---

## 用戶原始需求

> ${d.requirement || '(待填寫)'}

---

## 一句話目標

${d.goal || '(待填寫)'}

---

## 🏗️ 模組化設計藍圖

### 1. 族群識別

| 族群名稱 | 描述 | 特殊需求 |
|---------|------|---------|
${groupRows || '| (待填寫) | (待填寫) | (待填寫) |'}

### 2. 實體定義 (Entity Tables)
${entityBlocks || '\n(待填寫)'}

### 3. 共用模組 (Shared)

${sharedItems || '- [x] 基礎建設 (types, config, constants)'}

### 4. 獨立模組 (Modules)
${moduleBlocks || '\n(待填寫)'}

### 5. 路由結構

\`\`\`
${d.routes || 'main.ts\n└── router.ts\n    └── (待規劃)'}
\`\`\`

---

## 📅 迭代規劃表 (Iteration Planning)

| Iter | 範圍 | 目標 | 模組 | 依賴 |
|------|------|------|------|------|
${iterRows || '| 1 | Foundation | 基礎建設 | shared | 無 |'}

---

## 📋 模組動作清單 (Module Actions)
${actionBlocks || '\n(待填寫)'}

---

## 功能模組清單

${featureItems || '- [x] 基礎建設 (types, config)\n- [ ] (待填寫)'}

### 不做什麼

${exclusionItems || '- (待定義)'}

---

## 釐清項目
${clarificationBlocks || '\n### 使用者角色\n- [x] (待填寫)'}

---

## POC 驗證模式

**Level**: ${d.level || 'M'}

---

**草稿狀態**: [~] PENDING
`;
}

// ============================================
// 驗證 Draft 格式
// ============================================
function validateDraft(content) {
    const draftParser = require('./draft-parser.cjs');
    const draft = draftParser.parse(content);
    const isEnhanced = draftParser.isEnhancedDraft(draft);
    const stats = draftParser.calculateStats(draft);

    const checks = [];
    const warn = (msg) => checks.push({ level: 'WARN', msg });
    const fail = (msg) => checks.push({ level: 'FAIL', msg });
    const pass = (msg) => checks.push({ level: 'PASS', msg });

    // 必要項目
    if (draft.goal && draft.goal.length >= 10 && !draft.goal.includes('{'))
        pass('一句話目標');
    else fail('一句話目標未填寫或過短 (≥10 字)');

    if (draft.level && /^[SML]$/.test(draft.level))
        pass(`POC Level: ${draft.level}`);
    else fail('POC Level 未設定 (S/M/L)');

    if (draft.requirement && draft.requirement.length >= 20)
        pass('用戶原始需求');
    else fail('用戶原始需求過短 (≥20 字)');

    if (draft.groups && draft.groups.length >= 1)
        pass(`族群識別: ${draft.groups.length} 個`);
    else fail('族群識別未填寫');

    const moduleCount = Object.keys(draft.modules).length;
    if (moduleCount >= 1)
        pass(`獨立模組: ${moduleCount} 個`);
    else fail('獨立模組未定義');

    if (draft.sharedModules.some(s => s.checked))
        pass('共用模組已勾選');
    else fail('共用模組至少需勾選 1 個');

    if (draft.routes)
        pass('路由結構');
    else warn('路由結構未定義');

    // 建議項目 (Enhanced)
    if (stats.hasEntities)
        pass(`實體定義: ${stats.totalEntities} 個`);
    else warn('實體定義未填寫 (建議)');

    if (stats.hasIterationPlan)
        pass(`迭代規劃表: ${stats.totalIterations} 個迭代`);
    else warn('迭代規劃表未填寫 (建議)');

    if (stats.hasModuleActions)
        pass(`模組動作清單: ${stats.totalActions} 個動作`);
    else warn('模組動作清單未填寫 (建議)');

    // 功能模組
    const checkedFeatures = draft.features.filter(f => f.checked).length;
    if (checkedFeatures >= 2)
        pass(`功能模組: ${checkedFeatures} 個已勾選`);
    else fail('功能模組至少需勾選 2 個');

    // 佔位符
    const placeholders = ['{專案名稱}', '{貼上用戶原始需求}', '{填寫核心目標}', '{模組 1}', '{模組 2}'];
    const foundPlaceholders = placeholders.filter(p => content.includes(p));
    if (foundPlaceholders.length > 0)
        fail(`存在佔位符: ${foundPlaceholders.join(', ')}`);
    else pass('無佔位符');

    const fails = checks.filter(c => c.level === 'FAIL');
    const warns = checks.filter(c => c.level === 'WARN');
    const passes = checks.filter(c => c.level === 'PASS');

    return {
        valid: fails.length === 0,
        enhanced: isEnhanced,
        stats,
        checks,
        summary: {
            pass: passes.length,
            warn: warns.length,
            fail: fails.length,
        },
    };
}

// ============================================
// 讀取黃金模板
// ============================================
function getTemplate() {
    // v2: 優先使用 v2 模板
    const v2Path = path.join(__dirname, '..', 'templates', 'enhanced-draft-golden.template.v2.md');
    if (fs.existsSync(v2Path)) {
        return fs.readFileSync(v2Path, 'utf8');
    }
    const templatePath = path.join(__dirname, '..', 'templates', 'enhanced-draft-golden.template.md');
    if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf8');
    }
    return null;
}

// ============================================
// 讀取 Gemini Gem Prompt
// ============================================
function getGemPrompt() {
    const gemPath = path.join(__dirname, '..', '..', 'sdid-tools', 'prompts', 'gemini-gem-architect-v2.1.md');
    if (fs.existsSync(gemPath)) {
        return fs.readFileSync(gemPath, 'utf8');
    }
    return null;
}

// ============================================
// 導出
// ============================================
module.exports = {
    SYSTEM_PROMPT,
    assembleDraft,
    validateDraft,
    getTemplate,
    getGemPrompt,
};

// ============================================
// CLI
// ============================================
if (require.main === module) {
    const args = process.argv.slice(2);
    const c = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' };

    if (args.includes('--prompt')) {
        console.log(SYSTEM_PROMPT);
    } else if (args.includes('--gem-prompt')) {
        const gem = getGemPrompt();
        if (gem) console.log(gem);
        else console.log('❌ Gemini Gem prompt 不存在 (預期路徑: sdid-tools/prompts/gemini-gem-architect-v2.1.md)');
    } else if (args.includes('--template')) {
        const tpl = getTemplate();
        if (tpl) console.log(tpl);
        else console.log('❌ 模板檔案不存在');
    } else if (args.includes('--validate')) {
        const filePath = args[args.indexOf('--validate') + 1];
        if (!filePath || !fs.existsSync(filePath)) {
            console.error('❌ 請指定有效的 Draft 檔案路徑');
            process.exit(1);
        }
        const content = fs.readFileSync(filePath, 'utf8');
        const result = validateDraft(content);

        console.log(`\n${c.cyan}╔══════════════════════════════════════════╗${c.reset}`);
        console.log(`${c.cyan}║   📐 Enhanced Draft 驗證報告              ║${c.reset}`);
        console.log(`${c.cyan}╚══════════════════════════════════════════╝${c.reset}\n`);

        console.log(`Enhanced: ${result.enhanced ? '✅' : '❌ 普通 Draft'}`);
        console.log(`Valid: ${result.valid ? '✅ PASS' : '❌ FAIL'}\n`);

        for (const check of result.checks) {
            const icon = check.level === 'PASS' ? `${c.green}✅` :
                         check.level === 'WARN' ? `${c.yellow}⚠️` :
                         `${c.red}❌`;
            console.log(`  ${icon} ${check.msg}${c.reset}`);
        }

        console.log(`\n📊 結果: ${c.green}${result.summary.pass} pass${c.reset} | ${c.yellow}${result.summary.warn} warn${c.reset} | ${c.red}${result.summary.fail} fail${c.reset}`);

        process.exit(result.valid ? 0 : 1);
    } else if (args.includes('--assemble')) {
        const filePath = args[args.indexOf('--assemble') + 1];
        if (!filePath || !fs.existsSync(filePath)) {
            console.error('❌ 請指定有效的 JSON 檔案路徑');
            process.exit(1);
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(assembleDraft(data));
    } else {
        console.log(`
${c.cyan}Blueprint Architect${c.reset} - SDID 藍圖架構師

${c.cyan}用法:${c.reset}
  node blueprint-architect.cjs --prompt              輸出 AI System Prompt
  node blueprint-architect.cjs --gem-prompt          輸出 Gemini Gem 角色設定 Prompt
  node blueprint-architect.cjs --template            輸出空白黃金模板
  node blueprint-architect.cjs --validate <draft.md>  驗證 Draft 格式
  node blueprint-architect.cjs --assemble <data.json> 從 JSON 組裝 Draft

${c.cyan}AI Agent 整合:${c.reset}
  const { SYSTEM_PROMPT, validateDraft } = require('./blueprint-architect.cjs');
  // 用 SYSTEM_PROMPT 作為 AI 的 system message
  // 對話結束後用 validateDraft() 驗證產出
`);
    }
}
