# 📊 Task-Pipe 綜合能力評估報告

**版本**: v1.0  
**日期**: 2026-02-11  
**評估範圍**: Task-Pipe 核心流程 + Blueprint 系統 + LOG 機制 + MASTER_PLAN  
**評估依據**: iter-1 (M-level) + iter-2 (L-level) 實際執行結果 (recipe-manager)

---

## 1. 核心流程能力評估 (POC → PLAN → BUILD → SCAN)

### 1.1 POC 階段 (Step 1-5)

| 項目 | 評分 | 說明 |
|------|------|------|
| 模糊消除 (Step 1) | ⭐⭐⭐⭐ | 能有效識別需求缺口，產出結構化 requirement_draft |
| 規模評估 (Step 2) | ⭐⭐⭐⭐ | S/M/L 三級分類合理，config.json 的 maxStories/forbiddenPatterns 設計精準 |
| 契約設計 (Step 3) | ⭐⭐⭐⭐⭐ | @GEMS-CONTRACT + DB 型別註解，iter-2 的 recipeManagerV2Contract.ts 品質高 |
| UI 原型 (Step 4) | ⭐⭐⭐⭐ | 內嵌品質報告 (buildInlineQualityReport) 直接在 console 輸出 blockers/warnings |
| 需求規格 (Step 5) | ⭐⭐⭐⭐⭐ | 產出的 requirement_spec_iter-2.md 結構完整：Scope Declaration + BDD 驗收 + 欄位覆蓋規格 |

**實測結論**: POC 階段是整個流程中最成熟的部分。iter-2 L-level 的 requirement_spec 包含了 Scope Declaration（已驗證/延期功能分離）、BDD 格式驗收條件、欄位覆蓋規格表（v3.0 新增），品質已達 spec-level。

### 1.2 PLAN 階段 (Step 1-5)

| 項目 | 評分 | 說明 |
|------|------|------|
| 需求確認 (Step 1) | ⭐⭐⭐⭐ | 正常運作 |
| 規格注入 (Step 2) | ⭐⭐⭐⭐ | 能從 POC 產物自動提取函式清單，生成 implementation_plan |
| 架構審查 (Step 3) | ⭐⭐⭐ | 基本檢查，但深度有限 |
| 標籤規格設計 (Step 4) | ⭐⭐⭐ | 修復了 5 個 bug 後穩定：regex 修正、retry counter、work-item table 誤判、P0 warning 誤報、前端偵測誤判 |
| 需求規格說明 (Step 5) | ⭐⭐⭐⭐ | 正常運作 |

**實測結論**: PLAN 階段功能完整但 Step 4 是 bug 密集區。plan-spec-extractor.cjs 的 manifest 提取邏輯需要更強的容錯（中文 + 空格的 `\w+` 匹配問題已修）。產出的 implementation_plan 品質高，包含 GEMS 標籤模板、Integration 非 Mock 規範、E2E 場景規劃。

### 1.3 BUILD 階段 (Phase 1-8)

| 項目 | 評分 | 說明 |
|------|------|------|
| 骨架檢查 (Phase 1) | ⭐⭐⭐⭐ | 正常運作 |
| 標籤驗收 (Phase 2) | ⭐⭐⭐⭐ | gems-validator-lite 修復了 comment regex bug + interface 偵測後穩定 |
| 測試腳本 (Phase 3) | ⭐⭐⭐⭐ | 正常運作 |
| Test Gate (Phase 4) | ⭐⭐⭐⭐ | 修復了路徑加倍 bug (fn.file 已是相對路徑) |
| TDD 測試 (Phase 5) | ⭐⭐⭐⭐ | 正常運作，iter-2 累計 97 tests passing |
| 修改檔案測試 (Phase 6) | ⭐⭐⭐⭐ | 正常運作 |
| 整合檢查 (Phase 7) | ⭐⭐⭐⭐⭐ | v5.0 新增 findUnexportedFunctions — 正確攔截了 searchRecipes 未匯出問題 |
| Fillback (Phase 8) | ⭐⭐⭐⭐ | 產出 iteration_suggestions JSON，供 Ralph Loop 自動迭代 |

**實測結論**: BUILD 階段是最長的流程（8 個 Phase），經過 iter-1 + iter-2 共 4 個 Story 的實戰打磨，穩定度高。Phase 7 的 v5.0 強化是本次最重要的改進 — 解決了「函式寫好、測試過了、但沒匯出」的隱性問題。

### 1.4 SCAN 階段

| 項目 | 評分 | 說明 |
|------|------|------|
| 全專案掃描 | ⭐⭐⭐⭐ | 標籤 + 規格一致性驗證 |

### 1.5 核心流程總評

**整體評分: ⭐⭐⭐⭐ (4/5)**

強項：
- 完整的 4 階段 18 步驟流程，每步都有 checkpoint
- S/M/L 三級配置，L-level 要求完整 GEMS 標籤 + 全 8 Phase
- 「腳本 print → AI 讀取 → AI 執行」的設計哲學一致且有效
- 產物品質高（requirement_spec、implementation_plan、Fillback）

弱項：
- PLAN Step 4 是 bug 密集區，regex 和邊界條件處理需要持續強化
- 架構審查 (PLAN Step 3) 深度有限，目前主要是格式檢查

---

## 2. Blueprint 系統設計評估

### 2.1 Blueprint Architect (blueprint-architect.cjs)

| 項目 | 評分 | 說明 |
|------|------|------|
| SYSTEM_PROMPT 設計 | ⭐⭐⭐⭐⭐ | 5 輪結構化對話（目標→實體→模組→迭代→動作），引導清晰 |
| 模組化架構指引 | ⭐⭐⭐⭐⭐ | 6 層橫向分層 + 垂直分片，依賴規則明確，動作類型→目錄映射表完整 |
| assembleDraft() | ⭐⭐⭐⭐ | 從 JSON 組裝完整 Enhanced Draft，結構完整 |
| validateDraft() | ⭐⭐⭐⭐ | 必要項 + 建議項 + 佔位符偵測，分 PASS/WARN/FAIL 三級 |

**亮點**: SYSTEM_PROMPT 的品質是整個 Blueprint 系統的核心價值。它不只是「問問題」，而是攜帶了完整的架構知識（6 層分層、R1-R4 開發規則、動作類型映射表），讓 AI 在對話過程中就能做出正確的架構決策。

### 2.2 Blueprint Runner (blueprint-runner.cjs)

| 項目 | 評分 | 說明 |
|------|------|------|
| BlueprintState 狀態管理 | ⭐⭐⭐⭐ | JSON 持久化，支援重置/跳轉/歷史記錄 |
| 依賴檢查 | ⭐⭐⭐⭐ | checkDependencies 確保前置模組完成 |
| 並行偵測 | ⭐⭐⭐⭐ | 同 iter 無依賴的模組標記為可並行 (Multi-Agent Ready) |
| Enhanced/普通 Draft 雙模式 | ⭐⭐⭐⭐ | 自動偵測 Draft 格式，普通 Draft 退化為標準流程 |
| dry-run 模式 | ⭐⭐⭐ | 有實作但功能較簡單 |

### 2.3 Blueprint Kickstart (blueprint-kickstart.cjs)

| 項目 | 評分 | 說明 |
|------|------|------|
| 4 步啟動器 | ⭐⭐⭐⭐⭐ | Step 0-4 漸進式引導，每步都有明確的 @TASK 和 @OUTPUT |
| 狀態偵測 | ⭐⭐⭐⭐ | detectState + determineStep 自動判斷當前進度 |
| 驗證整合 | ⭐⭐⭐⭐ | Step 3 直接呼叫 validateDraft，失敗項目精準列出 |

**亮點**: Kickstart 的設計完美體現了「腳本 print → AI 讀取 → AI 執行 → 重複直到 @PASS」的哲學。每次執行都只做一件事，失敗時精準告訴 AI 要修什麼。

### 2.4 Draft Parser (draft-parser.cjs)

| 項目 | 評分 | 說明 |
|------|------|------|
| 零依賴 Markdown 解析 | ⭐⭐⭐⭐⭐ | 純 Node.js，不需要 js-yaml 或其他套件 |
| 解析完整度 | ⭐⭐⭐⭐ | 實體表格、迭代規劃表、模組動作清單、族群、checklist 全覆蓋 |
| 高階 API | ⭐⭐⭐⭐ | getModulesByIter、checkDependencies、calculateStats 等便利函式 |

### 2.5 Enhanced Draft 格式

| 項目 | 評分 | 說明 |
|------|------|------|
| 黃金模板 | ⭐⭐⭐⭐⭐ | 結構完整，註解豐富，每個區塊都有架構原則說明 |
| EcoTrack 範例 | ⭐⭐⭐⭐⭐ | M 級專案完整範例，動作清單含 P0-P1 優先級 + 流向 |
| 漸進填充 (Stub/Partial/Full) | ⭐⭐⭐⭐ | 遠期模組標 Stub，近期模組 Full，符合漸進開發理念 |

### 2.6 Blueprint 系統總評

**整體評分: ⭐⭐⭐⭐ (4.5/5)**

Blueprint 系統的設計水準很高。5 輪結構化對話 + Enhanced Draft 格式 + 零依賴解析器 + 4 步啟動器，形成了一個完整的「需求→規格」轉換管線。最大的價值在於 SYSTEM_PROMPT 攜帶的架構知識，讓 AI 不只是「記錄需求」而是「設計架構」。

---

## 3. LOG 機制評估

### 3.1 核心輸出函式

| 函式 | 用途 | 評分 |
|------|------|------|
| `anchorOutput()` | 完整結構化輸出（@CONTEXT/@INFO/@GUIDE/@RULES/@TASK/@TEMPLATE/@OUTPUT） | ⭐⭐⭐⭐⭐ |
| `anchorPass()` | 一行成功輸出 + 可選存檔 | ⭐⭐⭐⭐ |
| `anchorError()` | 錯誤輸出 + 策略漂移 + 染色分析 + 增量驗證 | ⭐⭐⭐⭐⭐ |
| `anchorErrorSpec()` | 精準錯誤規格（目標檔案 + 缺少項目 + 可複製範例 + 門控規格） | ⭐⭐⭐⭐⭐ |
| `anchorTemplatePending()` | 模板待填寫輸出（填寫項目 + 門控規格） | ⭐⭐⭐⭐ |
| `saveLog()` | 統一存檔（支援 Story ID 區分） | ⭐⭐⭐⭐ |

### 3.2 雙重輸出設計

`anchorOutput` 的核心設計是「終端精簡 + 檔案完整」：
- 終端機：只印結論和下一步指令，避免截斷
- logs/ 目錄：存完整內容，AI 可以回頭讀取

這個設計解決了 AI Agent 的一個根本問題：終端輸出有長度限制，但 AI 需要完整資訊才能做出正確決策。

### 3.3 v2.0 進階機制

| 機制 | 說明 | 評分 |
|------|------|------|
| 策略漂移 (Strategy Drift) | 3 層漸進：TACTICAL_FIX → STRATEGY_SHIFT → PLAN_ROLLBACK | ⭐⭐⭐⭐ |
| 染色分析 (Taint Analysis) | 修改函式後自動計算影響範圍（依賴圖） | ⭐⭐⭐⭐ |
| 增量驗證 (Incremental Validation) | 根據當前 Phase 決定驗證範圍（標籤/測試/整合） | ⭐⭐⭐⭐ |
| 錯誤分類器 (Error Classifier) | 自動分類錯誤為 [RECOVERABLE]/[MAYBE]/[STRUCTURAL] | ⭐⭐⭐⭐ |
| Prompt Repetition | 錯誤時重複軍規（禁止修改 task-pipe/、禁止讀取工具源碼） | ⭐⭐⭐⭐⭐ |

### 3.4 軍規系統 (Military Specs)

```
[MILITARY-SPECS] 軍規架構守則
  [X] 禁止修改 task-pipe/ 核心代碼
  [X] 禁止讀取工具源碼 (No tool-peeking)
  [X] 禁止刪除 .gems/ 目錄下任何檔案
  [O] 僅限修改專案業務檔案
  [O] 依據 logs/ 詳情進行精準修正

[ENV-CLEAN] 環境整潔守則
  [X] 禁止 sudo / 管理員權限安裝
  [X] 禁止 npm install -g
  [X] 禁止自行安裝 runtime
  [O] 安裝套件一律 --save-dev
```

這套軍規系統是 Task-Pipe 的「護城河」— 防止 AI 在修復錯誤時走偏（修改框架本身、刪除 log、全域安裝套件）。Prompt Repetition 在每次錯誤時重複這些規則，是基於論文 "Prompt Repetition Improves Non-Reasoning LLMs" 的實踐。

### 3.5 門控規格 (Gate Spec)

`anchorErrorSpec` 的 `gateSpec` 設計是一個精妙的創新：

```javascript
gateSpec: {
  checks: [
    { name: '路由整合', pattern: 'Page 組件已 import + Route 定義', desc: '...' },
    { name: '函式匯出驗證', pattern: 'Story 新增函式已從 barrel export 匯出', desc: '...' }
  ]
}
```

它告訴 AI「這個步驟會檢查什麼」，讓 AI 在修復時就知道要滿足哪些條件，而不是盲目嘗試。

### 3.6 LOG 機制總評

**整體評分: ⭐⭐⭐⭐⭐ (4.5/5)**

LOG 機制是 Task-Pipe 中設計最精緻的部分。雙重輸出（終端 + 檔案）、策略漂移（3 層漸進）、門控規格（告訴 AI 驗證邏輯）、軍規重複（防止 AI 走偏）— 這些機制共同構成了一個「AI 行為約束框架」，而不只是一個 logging 工具。

---

## 4. MASTER_PLAN.md 評估

### 4.1 現狀盤點準確性

MASTER_PLAN 對現有元件的盤點是準確的。6 個已有元件（Architect、Runner、Kickstart、Parser、黃金模板、EcoTrack 範例）的狀態描述與實際代碼一致。

### 4.2 缺口分析

MASTER_PLAN 識別了 6 個缺口：

| 缺口 | 評估 | 優先級 |
|------|------|--------|
| Draft → GEMS 標籤自動橋接 | ✅ 真實痛點。PLAN Step 4 目前靠 AI 手動推導 GEMS-DEPS | 高 |
| 迭代定義前後端一體化 | ⚠️ 有道理但非急迫。目前 recipe-manager 是純後端，未觸發此問題 | 中 |
| 基礎設施拆分規則 | ⚠️ 合理但可延後。shared 動作數 > 8 的判斷規則需要更多實測驗證 | 低 |
| Gemini Gem ↔ task-pipe 銜接 | ✅ 流程斷裂是真實問題，但解法可能不需要 MCP | 中 |
| API 層明確定義 | ✅ 跨模組整合點不夠明確，Phase 7 的匯出檢查只是部分解法 | 高 |
| Enhanced Draft 品質門控 | ✅ 目前只檢查格式不檢查語意，垃圾進垃圾出 | 高 |

### 4.3 方案設計評估

| 方案 | 可行性 | 風險 |
|------|--------|------|
| 動作清單加 deps 欄位 | ⭐⭐⭐⭐ | 表格太寬的問題真實存在，建議用折疊區塊 |
| 迭代規劃表加交付欄位 | ⭐⭐⭐⭐ | FULL/BACKEND/FRONTEND/INFRA 分類合理 |
| 模組公開 API 區塊 | ⭐⭐⭐⭐⭐ | 這是最有價值的改進，讓下游模組在 Stub 階段就知道可以呼叫什麼 |
| 基礎設施拆分規則 | ⭐⭐⭐ | 規則太死板的風險存在，建議只做 WARN 不做 FAIL |

### 4.4 實作路線評估

4 Phase 路線圖設計合理：

- Phase 1 (格式升級): 低風險，改文件不改程式 ✅
- Phase 2 (解析器升級): 中風險，draft-parser.cjs 需要新增解析邏輯 ⚠️
- Phase 3 (GEMS 橋接): 高價值，draft-to-gems.cjs 是核心新功能 ⭐
- Phase 4 (流程整合): 高風險，Gemini Gem 銜接需要外部依賴 ⚠️

**建議**: Phase 1-3 可以立即執行，Phase 4 建議延後到有明確的 Gemini Gem 匯出格式後再做。

### 4.5 待決策項目建議

| 決策點 | 建議 |
|--------|------|
| deps 欄位格式 | 用 `[Type.Name]` — 與 GEMS-DEPS 一致，減少轉換成本 |
| 交付欄位 | 用 `FULL/BACKEND/FRONTEND/INFRA` — 簡潔明確 |
| 公開 API 區塊 | 用簡化的 `name(args): return` — Markdown 可讀性優先 |
| draft-to-gems.cjs 輸出 | 用 Markdown — 可直接貼到 implementation_plan，人類可讀 |

### 4.6 MASTER_PLAN 總評

**整體評分: ⭐⭐⭐⭐ (4/5)**

MASTER_PLAN 的分析深度和方案設計都很紮實。缺口識別準確，方案設計務實（Markdown 優先、向後相容、漸進增強、零外部依賴），與 Task-Pipe 的核心哲學一致。唯一的風險是 Phase 4 的外部依賴（Gemini Gem 銜接），建議延後。

---

## 5. 實測發現的 Bug 與修復

| # | 位置 | 問題 | 修復 | 影響 |
|---|------|------|------|------|
| 1 | step-4.cjs | regex 匹配錯誤 | 修正正則表達式 | PLAN Step 4 |
| 2 | step-4.cjs | retry counter 不遞增 | 修正計數邏輯 | PLAN Step 4 |
| 3 | step-4.cjs | work-item table 誤判 | 修正表格偵測邏輯 | PLAN Step 4 |
| 4 | step-4.cjs | P0 warning 當 error | 修正嚴重度判斷 | PLAN Step 4 |
| 5 | step-4.cjs | 前端偵測誤判 | 修正偵測邏輯 | PLAN Step 4 |
| 6 | gems-validator-lite.cjs | comment regex 無法匹配 @GEMS-FUNCTION 行 | 修正正則 + 新增 interface 偵測 | BUILD Phase 2 |
| 7 | plan-spec-extractor.cjs | manifest 提取優先級錯誤 | 改為優先使用 GEMS tags | PLAN Step 2 |
| 8 | phase-4.cjs | 路徑加倍 (fn.file 已是相對路徑) | 改用 path.resolve(fn.file) | BUILD Phase 4 |

**模式分析**: 8 個 bug 中有 5 個集中在 PLAN Step 4 (step-4.cjs)，這是整個流程中最複雜的步驟（標籤規格設計），需要處理多種格式的 Markdown 表格和 GEMS 標籤。建議未來對 Step 4 增加更多邊界條件測試。

---

## 6. Phase 7 強化效果

### 問題
iter-2 Story-2.1 的 `searchRecipes` 函式寫好了、測試也過了（97 tests passing），但沒有從 `recipe-core/index.ts` 匯出。外部模組 import 不到，等於沒寫。

### 解法
Phase 7 v5.0 新增 `findUnexportedFunctions()`：
1. 讀取 implementation_plan 取得 Story 的函式清單
2. 用 gems-validator-lite 掃描 src 找到已標籤的函式
3. 對每個函式檢查其模組的 index.ts 是否有 export
4. 未匯出 = BLOCKER（禁止 --pass 跳過）

### 驗證
- Story-2.1: 正確攔截 `searchRecipes` 未從 `recipe-core/index.ts` 匯出 → BLOCKER
- Story-2.0: 正確 PASS（其函式在 shared/，不在 modules/ barrel）

---

## 7. 總結

### 能力定位

Task-Pipe 是一個**中高階的 AI 協作開發框架**，其核心價值不在於「自動寫程式」，而在於：

1. **流程約束**: 18 步驟的強制流程，防止 AI 跳步或腦補
2. **品質門控**: 每步都有 checkpoint，BLOCKER 級問題禁止跳過
3. **行為約束**: 軍規系統 + Prompt Repetition，防止 AI 走偏
4. **產物標準化**: requirement_spec、implementation_plan、Fillback 格式統一
5. **自我修復**: 策略漂移 + 染色分析 + 增量驗證，錯誤處理有層次

### 成熟度

| 模組 | 成熟度 | 說明 |
|------|--------|------|
| POC 流程 | 🟢 生產就緒 | 經過 M + L 兩級實測 |
| PLAN 流程 | 🟡 可用但需注意 | Step 4 是 bug 密集區 |
| BUILD 流程 | 🟢 生產就緒 | 8 Phase 全部實測通過，Phase 7 已強化 |
| SCAN 流程 | 🟢 生產就緒 | 正常運作 |
| Blueprint 系統 | 🟡 設計完成，待大規模實測 | 工具齊全但只在 recipe-manager 上跑過 |
| LOG 機制 | 🟢 生產就緒 | 設計精緻，v2.0 進階機制完整 |
| MASTER_PLAN | 🟡 方向正確，待執行 | Phase 1-3 可立即開始 |

### 建議優先事項

1. **PLAN Step 4 穩定化** — 增加邊界條件測試，這是目前最脆弱的環節
2. **MASTER_PLAN Phase 3 (draft-to-gems.cjs)** — 最高 ROI 的改進，自動橋接 Draft → GEMS 標籤
3. **模組公開 API 區塊** — 讓 Phase 7 的匯出檢查有更明確的依據

---

**報告產出日期**: 2026-02-11  
**評估者**: AI Agent (基於 iter-1 M-level + iter-2 L-level 實測)
