# 📐 Blueprint Evolution — Master Plan

**版本**: v1.0  
**日期**: 2026-02-11  
**狀態**: 🚀 執行中

---

## 0. 願景

**VIBE → SEMANTIC → SPEC → BLUEPRINT → INCREMENTAL BUILD**

一份活藍圖驅動整個開發生命週期。藍圖隨開發進度自動收縮，已完成的迭代削減或摘要化，未完成的迭代逐步展開。

**核心改變**: 取消 POC + PLAN 階段，前四階段由 Gemini Gem chatbot 完成，task-pipe 只負責 Gate + BUILD + LOG。

```
Gem chatbot (5 輪對話)
    ↓ 產出
活藍圖 (Enhanced Draft v2 + GEMS 標籤)
    ↓ 存入
.gems/iterations/iter-N/poc/requirement_draft_iter-N.md
    ↓
blueprint-gate.cjs (驗證格式 + 標籤完整性)
    ↓ @PASS
draft-to-plan.cjs (機械轉換 → implementation_plan per Story)
    ↓
BUILD Phase 1-8 (現有流程，不改)
    ↓
blueprint-shrink.cjs (收縮藍圖，標記已完成)
    ↓
進入 iter-2（Stub 展開為 Full）
```

---

## 1. 現狀盤點

### 1.1 已有的東西

| 元件 | 位置 | 狀態 | 說明 |
|------|------|------|------|
| Blueprint Architect | `tools/blueprint-architect.cjs` | ✅ 可用 | 5 輪對話 System Prompt + Draft 組裝 + 驗證 |
| Blueprint Runner | `tools/blueprint-runner.cjs` | ✅ 可用 | Enhanced Draft 驅動的開發執行器 |
| Blueprint Kickstart | `tools/blueprint-kickstart.cjs` | ✅ 可用 | 4 步啟動器 |
| Draft Parser | `tools/draft-parser.cjs` | ✅ 可用 | Markdown 解析器，零依賴 |
| 黃金模板 | `templates/enhanced-draft-golden.template.md` | ✅ 可用 | Enhanced Draft 格式模板 |
| EcoTrack 範例 | `templates/examples/enhanced-draft-ecotrack.example.md` | ✅ 可用 | M 級專案完整範例 |
| Gemini Gem | 外部 (Gemini) | ✅ 運作中 | 5 輪審查對話，產出 Enhanced Draft |
| BUILD Phase 1-8 | `phases/build/` | ✅ 生產就緒 | 經 iter-1 M + iter-2 L 實測 |
| LOG 機制 | `lib/shared/log-output.cjs` | ✅ 生產就緒 | 雙重輸出 + 策略漂移 + 軍規 |

### 1.2 缺口 (本次要解決)

| 缺口 | 影響 | 解法 |
|------|------|------|
| 藍圖不攜帶 GEMS 標籤資訊 | 需要跑 PLAN Step 2-4 才能產出標籤 | 動作清單加 deps 欄位，Gem 直接產出 |
| 沒有藍圖→執行計畫的機械轉換 | 依賴 AI 跑 PLAN（bug 密集區） | `draft-to-plan.cjs` 純腳本轉換 |
| 沒有藍圖品質門控 | 垃圾進垃圾出 | `blueprint-gate.cjs` 驗證 |
| 藍圖不會收縮 | 每個 iter 都是獨立文件，沒有全局視圖 | `blueprint-shrink.cjs` 自動削減 |
| iter-2 Stub 無法展開 | 進入新 iter 時缺少資訊 | 從 Fillback suggestions 補充展開 |

---

## 2. 活藍圖格式 v2

### 2.1 動作清單升級

**現有格式**:
```
| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
```

**v2 格式** (iter-1 Full):
```
| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 狀態 |
|---------|------|---------|---|------|------|------|
| 核心型別 | CONST | CoreTypes | P0 | DEFINE→FREEZE→EXPORT | 無 | ○○ |
| 儲存層 | LIB | storage | P1 | INIT→CRUD→EXPORT | [Internal.CoreTypes] | ○○ |
```

新增欄位：
- `依賴`: GEMS-DEPS 壓縮格式 `[Type.Name]`
- `狀態`: `○○` (未開始) → `✓○` (部分完成) → `✓✓` (完成) → `[DONE]` (已收縮)

**v2 格式** (iter-2+ Stub):
```
### Iter 2: data-entry [STUB]
> 引導式數據填報 + CO2e 計算
> 依賴: shared | 預估: 3-5 個 P0/P1 動作
> 公開 API: createRecord, getRecords, calcEmission
```

Stub 只保留：模組描述、依賴、預估規模、公開 API 簽名。進入 iter-2 時從 Fillback suggestions + Gem 對話展開為 Full。

### 2.2 迭代規劃表升級

```
| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別+配置+儲存 | shared | INFRA | 無 | [CURRENT] |
| 2 | Core MVP | 數據填報 | data-entry | FULL | shared | [STUB] |
| 3 | Viz | 看板 | dashboard | FULL | shared,data-entry | [STUB] |
```

交付類型: `FULL` / `BACKEND` / `FRONTEND` / `INFRA`
狀態: `[STUB]` → `[CURRENT]` → `[DONE]` → 削減/摘要化

### 2.3 模組公開 API 區塊

```markdown
#### 模組：data-entry (數據填報)
- 依賴: [shared/types, shared/storage]
- 公開 API (index.ts):
  - createRecord(data: RecordInput): Promise<EmissionRecord>
  - getRecords(orgId: string, period: string): Promise<EmissionRecord[]>
  - calcEmission(amount: number, factorId: string): number
```

讓下游 Stub 模組在設計階段就知道可以呼叫什麼。

### 2.4 藍圖生命週期

```
iter-1 開始: 藍圖 100% (iter-1 Full + iter-2~N Stub)
iter-1 完成: 藍圖收縮 (iter-1 → 一行摘要 + [DONE])
iter-2 開始: iter-2 Stub → Full (從 Fillback 展開)
iter-2 完成: 藍圖再收縮
...
iter-N 完成: 藍圖 → 空 → 專案完成
```

---

## 3. 新增工具

### 3.1 blueprint-gate.cjs

**位置**: workspace 根目錄 `sdid-tools/blueprint-gate.cjs` (獨立工具，不 import task-pipe)

**功能**: 驗證活藍圖品質，取代 POC + PLAN 的驗證功能

驗證項目：
- 格式完整性（一句話目標、族群、實體、模組、迭代規劃表、動作清單）
- 標籤完整性（iter-1 的動作必須有 techName + priority + flow + deps）
- flow 步驟數 (3-7 個)
- deps 無循環
- 迭代依賴是 DAG
- 基礎設施拆分建議 (shared 動作數 > 8 → WARN)
- 佔位符偵測
- iter-2+ Stub 最低資訊檢查（描述 + 依賴 + 預估）

輸出：`@PASS` 或 `@BLOCKER` + 修復指引

### 3.2 draft-to-plan.cjs

**位置**: workspace 根目錄 `sdid-tools/draft-to-plan.cjs` (獨立工具)

**功能**: 從活藍圖的當前 iter 動作清單，機械轉換為 implementation_plan per Story

轉換邏輯（確定性，零 AI 推導）：
1. 解析藍圖，取得當前 iter 的動作清單
2. 按模組分組 → 每個模組 = 一個 Story
3. 每個動作行展開為 GEMS 標籤模板：
   - techName → `GEMS: techName`
   - priority → `| P0 |`
   - flow → `GEMS-FLOW: step1→step2→step3`
   - deps → `GEMS-DEPS: [Type.Name]`
   - 自動推導 GEMS-DEPS-RISK (deps 中 Module.* 數量)
   - 自動推導 GEMS-TEST (P0→Unit+Integration, P1→Unit+Integration, P2→Unit, P3→Unit)
4. 套用 implementation_plan Markdown 模板輸出
5. 寫入 `.gems/iterations/iter-N/plan/implementation_plan_Story-X.Y.md`

**輸入**: 活藍圖路徑 + iteration + Story ID
**輸出**: implementation_plan Markdown 檔案

### 3.3 blueprint-shrink.cjs

**位置**: workspace 根目錄 `sdid-tools/blueprint-shrink.cjs` (獨立工具)

**功能**: iter 完成後收縮藍圖

收縮邏輯：
1. 讀取 Fillback 的 iteration_suggestions JSON
2. 已完成 iter 的動作清單 → 折疊為一行摘要：
   ```
   ### Iter 1: shared [DONE]
   > ✅ 4 個動作完成 (2×P0, 1×P1, 1×P2) | 測試: 15 pass
   ```
3. 下一個 iter 的 Stub → 保持不動（等使用者/Gem 展開）
4. 將 Fillback suggestions 中的新發現附加到對應 Stub 的備註

### 3.4 blueprint-expand.cjs (可選)

**位置**: workspace 根目錄 `sdid-tools/blueprint-expand.cjs` (獨立工具)

**功能**: 進入新 iter 時，將 Stub 展開為 Full

展開來源：
1. Fillback suggestions（前一個 iter 的發現）
2. Gem chatbot 補充對話（使用者確認細節）
3. 公開 API 區塊（已知的介面簽名）

---

## 4. 決策記錄

| 決策點 | 決定 | 理由 |
|--------|------|------|
| deps 欄位格式 | `[Type.Name]` | 與 GEMS-DEPS 一致，減少轉換成本 |
| 交付欄位 | `FULL/BACKEND/FRONTEND/INFRA` | 簡潔明確 |
| 公開 API 區塊 | 簡化 `name(args): return` | Markdown 可讀性優先 |
| draft-to-plan 輸出 | Markdown | 可直接貼到 plan，人類可讀 |
| 工具位置 | workspace 根目錄 `sdid-tools/` | 獨立工具，不 import task-pipe |
| PLAN 階段 | 取消（S/M 級） | 藍圖 + 解析器直接轉換，繞過 bug 密集區 |

---

## 5. 實作路線

### Phase 1: 活藍圖格式定義 (改文件)
- [x] 更新 `enhanced-draft-golden.template.v2.md` — 加入 deps、狀態、交付、公開 API ✅
- [x] 更新 EcoTrack 範例 — 示範 v2 格式（含 [DONE] 和 [STUB]）✅
- [x] 更新 Architect SYSTEM_PROMPT — 引導 Gem 產出 v2 格式 ✅

### Phase 2: 核心工具 (新增腳本)
- [x] `sdid-tools/draft-to-plan.cjs` — 藍圖→執行計畫轉換器 ✅
- [x] `sdid-tools/blueprint-gate.cjs` — 藍圖品質門控 ✅
- [x] `sdid-tools/lib/draft-parser-standalone.cjs` — 獨立版 Draft 解析器 ✅

### Phase 3: 生命週期工具
- [x] `sdid-tools/blueprint-shrink.cjs` — 藍圖收縮 ✅
- [x] `sdid-tools/blueprint-expand.cjs` — Stub 展開 ✅

### Phase 4: 整合測試
- [x] 用 EcoTrack 範例跑一輪：Gate → Plan 生成 → Shrink → Expand ✅
- [ ] 用 recipe-manager 或新專案跑實戰：Gem 產出 → Gate → Plan → BUILD → Shrink

---

## 6. 檔案結構

```
workspace 根目錄/
├── sdid-tools/                        ← 獨立工具（不 import task-pipe）
│   ├── blueprint-gate.cjs             ← Phase 2: 藍圖品質門控
│   ├── draft-to-plan.cjs             ← Phase 2: 藍圖→執行計畫
│   ├── blueprint-shrink.cjs          ← Phase 3: 藍圖收縮
│   ├── blueprint-expand.cjs          ← Phase 3: Stub 展開
│   └── lib/
│       └── draft-parser-standalone.cjs ← 獨立版解析器
│
├── task-pipe/                         ← 現有（不改）
│   ├── phases/build/                  ← BUILD Phase 1-8（不動）
│   ├── lib/shared/log-output.cjs      ← LOG 機制（不動）
│   ├── tools/
│   │   ├── blueprint-architect.cjs    ← Phase 1 更新 SYSTEM_PROMPT
│   │   └── draft-parser.cjs           ← 參考用（sdid-tools 有獨立版）
│   ├── templates/
│   │   ├── enhanced-draft-golden.template.md  ← Phase 1 更新
│   │   └── examples/
│   │       └── enhanced-draft-ecotrack.example.md  ← Phase 1 更新
│   └── blueprint-evolution/
│       ├── MASTER_PLAN.md             ← 你正在看的這份
│       └── TASK_PIPE_ASSESSMENT_REPORT.md
```

---

## 7. 設計原則

1. **Markdown 優先**: 所有格式都是 Markdown，人類可讀、AI 可寫、Git 可追蹤
2. **向後相容**: 舊格式 Draft 照常運作，新欄位「建議」不「必要」
3. **零外部依賴**: 純 Node.js，不需要 npm install
4. **獨立部署**: sdid-tools 不 import task-pipe，可獨立使用
5. **確定性轉換**: draft-to-plan 是純機械轉換，零 AI 推導
6. **活藍圖哲學**: 藍圖是 single source of truth，隨開發進度自動收縮

---

## 8. 風險

| 風險 | 緩解 |
|------|------|
| 動作清單加欄位後表格太寬 | 考慮折疊區塊或分段顯示 |
| Gem prompt 同步成本 | `--prompt` 指令匯出最新 prompt |
| 品質門控太嚴格 | 分 WARN/FAIL，只有結構性問題才 FAIL |
| 藍圖收縮後資訊遺失 | [DONE] 保留一行摘要，完整記錄在 .gems/iterations/ |

---

---

## 9. v2.1 變異點分析 (2026-02-12)

### 9.1 問題

使用者給出「彈性」「客製化」等複合需求時，傳統模糊消除容易越問越模糊。
需要一個結構化方法，將複合需求拆解為分層演化。

### 9.2 解法: 分層拆解 (Layered Decomposition)

1. Architect Round 1.5 (條件觸發): 偵測不確定性詞彙 → 名詞提取 → 固定/可變標記 → 分層定義
2. 藍圖新增「變異點分析」區塊: 名詞分析表 + 分層定義表 + 確認狀態
3. 動作清單新增「演化」欄位: BASE / L1 / L2 ...
4. 新增 `Modify` 動作類型: 修改既有函式 (加參數/改邏輯)
5. Shrink 支援 `[EVOLVED]` 狀態: 模組不是全部完成，只是當前層完成

### 9.3 實作清單

- [x] `blueprint-architect.cjs` — Round 1.5 分層拆解 + 演化欄位 ✅
- [x] `enhanced-draft-golden.template.v2.md` → v2.1 — 變異點分析區塊 + 演化欄位 ✅
- [x] `draft-parser-standalone.cjs` — 解析演化欄位 + 變異點分析 ✅
- [x] `blueprint-gate.cjs` — 演化層依賴驗證 (EVO-001, EVO-002) ✅
- [x] `blueprint-shrink.cjs` — [EVOLVED] 狀態 + 演化層統計 ✅
- [x] `draft-to-plan.cjs` — Modify 動作支援 + Evolution 標記 ✅
- [x] `blueprint-verify.cjs` — 藍圖↔源碼雙向語意比對 (全新工具) ✅
- [x] 測試: 48/48 pass (meal-pricing-blueprint 範例) ✅
- [x] 向後相容: EcoTrack v1/v2 範例正常 ✅

---

*Blueprint Evolution v1.0 → v2.1 | 2026-02-12*
