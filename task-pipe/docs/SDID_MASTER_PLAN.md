# SDID 全局總覽 — Master Plan v2.1

> 版本: v2.1 | 日期: 2026-02-16
> 用途: 自包含文件，供外部 chatbot 理解 SDID 全貌並進行討論
> 語言: 繁體中文

---

## 0. 一句話定義

SDID (Script-Driven Iterative Development) 是一套「AI 驗收協議」— 用腳本驅動的 Gate 機制，把 AI 的隨機輸出約束成可預測的結構化產出。它不生成程式碼，不呼叫 LLM API，只定義「AI 該做什麼、怎麼驗證、失敗了怎麼辦」。

核心哲學: **腳本決定，AI 執行。Gate 比記憶重要。**

---

## 1. SDID 解決什麼問題

AI coding tools (Cursor, Kiro, Copilot) 解決「怎麼寫程式碼」。
SDID 解決「寫什麼、怎麼驗、寫完了沒」。

| 問題 | 傳統 AI coding | SDID 做法 |
|------|---------------|----------|
| AI 亂寫一通 | 人工 review | Gate 腳本自動驗收，不過就重來 |
| 需求模糊 | AI 自己猜 | POC 階段強制模糊消除 |
| 做到一半忘了 | 重新開對話 | project-memory 自動記錄進度 |
| 標籤/規格不一致 | 沒人管 | GEMS 標籤協議 + BUILD Phase 2 掃描 |
| 複雜專案結構混亂 | vibe coding 碰運氣 | 迭代規劃 + 模組化 Story 拆分 |

---

## 2. 系統架構

### 2.1 雙引擎

SDID 有兩個獨立的工具鏈，服務兩種不同的開發風格：

```
┌─────────────────────────────────────────────────────┐
│                    SDID 雙引擎                        │
│                                                       │
│  ┌─ task-pipe (規格導向) ──┐  ┌─ sdid-tools (Vibe 導向) ─┐ │
│  │ POC → PLAN → BUILD → SCAN │  │ Gate → Plan → BUILD      │ │
│  │ 16 個 step 腳本           │  │   → Shrink → Expand      │ │
│  │ runner.cjs 主入口         │  │   → Verify               │ │
│  │ 結構化需求分析            │  │ 5 個獨立工具              │ │
│  └───────────────────────────┘  └──────────────────────────┘ │
│                                                       │
│              ┌─ 共用層 ─────────────────┐              │
│              │ log-output.cjs (輸出協議) │              │
│              │ project-memory.cjs (記憶) │              │
│              │ emit* 函式 (統一信號)     │              │
│              │ BUILD Phase 1-8 (共用)    │              │
│              └──────────────────────────┘              │
└─────────────────────────────────────────────────────┘
```

**task-pipe** — 規格導向入口。適合需求明確、需要嚴謹驗證的專案。走 POC (5 步) → PLAN (5 步) → BUILD (8 步) → SCAN 完整流程。

**sdid-tools** — Vibe 導向入口。適合用 Gemini Gem chatbot 對話產出架構設計的場景。走 Gate → draft-to-plan → BUILD → Shrink → Expand → Verify 循環。

兩條路線的目的地一樣：產出 `implementation_plan` → 進入 BUILD Phase 1-8。BUILD 不需要知道你從哪條路來的。

### 2.2 檔案結構

```
workspace/
├── task-pipe/                          ← 規格導向引擎
│   ├── runner.cjs                      ← 主入口 (phase/step 路由)
│   ├── phases/
│   │   ├── poc/step-1~5.cjs           ← POC 階段 (模糊消除→契約→原型→規格)
│   │   ├── plan/step-1~5.cjs          ← PLAN 階段 (需求→計畫→架構審查)
│   │   ├── build/phase-1~8.cjs        ← BUILD 階段 (骨架→標籤→測試→整合→Fillback)
│   │   └── scan/scan.cjs              ← SCAN 階段 (全專案掃描)
│   ├── lib/shared/
│   │   ├── log-output.cjs             ← 輸出協議 v3.0 + emit* 函式
│   │   └── project-memory.cjs         ← 記憶系統 v1.0
│   └── docs/                          ← 文件
│
├── sdid-tools/                         ← Vibe 導向引擎 (獨立，不 import task-pipe)
│   ├── blueprint-gate.cjs             ← 藍圖品質門控
│   ├── draft-to-plan.cjs             ← 藍圖→執行計畫 (機械轉換，零 AI)
│   ├── blueprint-shrink.cjs          ← 迭代完成後收縮藍圖
│   ├── blueprint-expand.cjs          ← 進入新迭代時展開 Stub
│   ├── blueprint-verify.cjs          ← 藍圖↔源碼雙向語意比對
│   └── lib/
│       ├── log-output.cjs            ← 輸出協議 (與 task-pipe 同步)
│       └── draft-parser-standalone.cjs ← Enhanced Draft 解析器
│
└── {project}/                          ← 目標專案
    └── .gems/
        ├── iterations/iter-X/
        │   ├── poc/                   ← requirement_draft, spec, POC.html, Contract.ts
        │   ├── plan/                  ← implementation_plan_Story-X.Y.md
        │   ├── build/                 ← Fillback, iteration_suggestions
        │   └── logs/                  ← 所有 gate/phase 的執行日誌
        └── project-memory.json        ← 記憶系統資料
```

---

## 3. 核心機制

### 3.1 GEMS 標籤協議

每個函式必須攜帶結構化標籤，BUILD Phase 2 自動掃描驗收：

```typescript
/**
 * GEMS: addTodo | P0 | ✓✓ | (input)→Todo | Story-1.0 | 新增待辦事項
 * GEMS-FLOW: Validate→Create→Store→Return
 * GEMS-DEPS: [Internal.CoreTypes (型別定義)], [Lib.MemoryStore (儲存層)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: add-todo.test.ts
 */
```

標籤的價值：讓腳本能精確知道每個函式的優先級、依賴、測試狀態、流程步驟，不需要 AI 去「理解」程式碼。

### 3.2 輸出協議 v3.0

核心策略: **Terminal Signal Only + @READ + @GUARD**

```
終端只印信號 (5-10 行):
  @PASS / @FIX / @FILL / @BLOCK    ← 結果信號
  TARGET: src/xxx.ts                ← 目標檔案
  @HINT: 前一個 Story 曾在此失敗    ← 歷史提示
  @READ: .gems/.../xxx.log          ← 強制 AI 讀 log
  NEXT: node task-pipe/...          ← 下一步指令
  @GUARD: 禁止修改 src/shared/types ← 施工紅線

細節全部存 log 檔案 → AI 必須讀 log 才能修復 → 修復品質提升
```

4 個統一 emit 函式 (雙引擎同步):
- `emitPass` — 成功 + 進度 + 下一步
- `emitFix` — 可修復錯誤 + 目標 + 缺失項 + 範例
- `emitFill` — 需要填空的模板 (如 implementation_plan)
- `emitBlock` — 結構性阻擋，無法局部修復

### 3.3 記憶系統 (project-memory)

設計原則: **File-first, JSON-structured, Script-driven**

```
存放: {project}/.gems/project-memory.json
寫入: 腳本自動 append (不靠 AI 判斷)
讀取: runner.cjs 啟動時印 @MEMORY resume
裁剪: 超過 200 筆自動刪舊的
```

功能:
- `recordEntry()` — 每次 Phase/Step 執行完自動記錄 verdict + summary
- `getResumeContext()` — 新對話開始時印出最近 5 筆 + pitfall
- `getHistoricalHint()` — 查詢同 phase/step 歷史錯誤，產出 @HINT

跟 OpenClaw 的差異: OpenClaw 用 embedding + vector search 做語義記憶，AI 自己決定記什麼。SDID 用純 JSON 精確查詢，腳本自動記錄。因為 SDID 的記憶是確定性的 — 腳本跑完就知道結果，不需要 AI 去「回憶」。

### 3.4 策略漂移 (Strategy Drift)

重試不是單純重複，而是維度的提升：

| Level | 重試次數 | 策略 | 行動 |
|-------|---------|------|------|
| 1 | 1-3 次 | TACTICAL_FIX | 局部修補，在原檔案修復 |
| 2 | 4-6 次 | STRATEGY_SHIFT | 換方式實作，考慮重構 |
| 3 | 7+ 次 | PLAN_ROLLBACK | 質疑架構，回退 PLAN 階段 |

搭配染色分析 (Taint Analysis) 計算修改影響範圍，增量驗證只跑改動範圍。

---

## 4. 兩條流程詳解

### 4.1 Task-Pipe Flow (規格導向)

```
POC (5 步): 模糊消除 → 規模評估 → 契約設計 → UI 原型 → 需求規格
    ↓
PLAN (5 步): 需求確認 → 規格注入 → 架構審查 → 標籤設計 → 最終確認
    ↓
BUILD (8 步): 骨架 → 標籤驗收 → 測試腳本 → Test Gate → TDD → 整合測試 → 整合檢查 → Fillback
    ↓
SCAN: 全專案掃描，驗證標籤+規格一致性
```

每一步都有獨立腳本 + Gate 驗證。不過就重來，不能跳步。

### 4.2 Blueprint Flow (Vibe 導向)

```
Gemini Gem 對話 (5 輪) → Enhanced Draft (活藍圖)
    ↓
blueprint-gate.cjs → 驗證藍圖品質 (格式、標籤、依賴 DAG)
    ↓
draft-to-plan.cjs → 機械轉換為 implementation_plan (零 AI 推導)
    ↓
BUILD Phase 1-8 (與 Task-Pipe 共用)
    ↓
blueprint-shrink.cjs → 收縮已完成的迭代 (Full → 一行摘要)
    ↓ (如果有下一個 iter)
blueprint-expand.cjs → 展開 Stub 為 Full (從 Fillback + Gem 對話)
    ↓
blueprint-verify.cjs → 藍圖↔源碼雙向語意比對
```

活藍圖哲學: 藍圖是 single source of truth，隨開發進度自動收縮。已完成的迭代削減為摘要，未完成的逐步展開。

### 4.3 兩條路線的交會點

```
                    ┌─ Vibe 入口 (Blueprint) ─┐
                    │  Gem 對話 → Draft        │
使用者選擇 ────────►│                          ├──► implementation_plan ──► BUILD
                    │  Draft → POC → Spec      │    (格式完全一致)
                    ├─ 規格入口 (Task-Pipe) ──┤
                    │  Draft → Step 1-5        │
                    └──────────────────────────┘
```

BUILD 不需要知道你從哪條路來的，它只看 plan 的格式對不對。

---

## 5. 已完成的里程碑

### Phase 0: 基礎建設 (2026-02 初)
- ✅ task-pipe 四階段管線 (POC/PLAN/BUILD/SCAN) + 16 個 step 腳本
- ✅ GEMS 標籤協議 + BUILD Phase 2 自動掃描
- ✅ 策略漂移三層機制
- ✅ 實戰驗證: recipe-manager (iter-1 M + iter-2 L), bookmark-app, todo-app

### Blueprint Evolution v1.0→v2.1 (2026-02-11~12)
- ✅ sdid-tools 5 個獨立工具 (gate, draft-to-plan, shrink, expand, verify)
- ✅ Enhanced Draft v2 格式 (動作清單 + 依賴 + 狀態 + 公開 API)
- ✅ 活藍圖生命週期 (Full → [DONE] → Stub → Full → ...)
- ✅ v2.1 變異點分析 (分層拆解 + 演化欄位 + Modify 動作類型)
- ✅ Gemini Gem Architect prompt (5 輪審查對話)
- ✅ 測試: 48/48 pass

### 輸出協議 v3.0 (2026-02-14)
- ✅ Terminal Signal Only — 終端只印信號，細節存 log
- ✅ @READ 機制 — 強制 AI 讀 log (Information Gap Strategy)
- ✅ @GUARD 統一 — 4 種施工紅線合併為 1 種
- ✅ NEXT 統一 — 消除同義詞，統一指令介面
- ✅ 雙引擎同步 — task-pipe + sdid-tools 共用 emit* 函式

### P0: 記憶系統接入 (2026-02-14)
- ✅ project-memory.cjs 實作 (recordEntry, getResumeContext, getHistoricalHint)
- ✅ runner.cjs 啟動時印 @MEMORY，step 完成後自動記錄
- ✅ log-output.cjs 的 anchorError 加入 @HINT
- ✅ 測試: 13/13 passed

### Phase 1: emit 函式整併 (2026-02-14)
- ✅ 4 個統一 emit 函式 (emitPass/emitFix/emitFill/emitBlock)
- ✅ 雙引擎同步 (task-pipe + sdid-tools)
- ✅ 舊函式保留向後相容
- ✅ 測試: 44/44 passed

### Phase 2: Step 標準化 (2026-02-15)
- ✅ BUILD Phase 1-8 全部遷移到 emit* 函式
- ✅ POC/PLAN/SCAN import 更新 (emit* 可用)
- ✅ runner.cjs 修復 projectMemory require (CRLF 問題)
- ✅ 測試: 57/57 passed, todo-app 實測 OK

### Phase 2: 語意驅動方向 (2026-02-16)
- ✅ P5: Quick Mode — runner.cjs --quick flag + loop.cjs --mode=quick + iter-quick-NNN 命名 + @RESUME 中斷續接
- ✅ P8: Plan 路徑驗證 — plan-validator Rule 9 (FILE 欄位路徑存在檢查) + config.json 棕地三欄位 (srcDir/testPattern/testCommand)
- ✅ P7: Adversarial Review 併入 Phase 8 — 假實作偵測 + AC 覆蓋檢查 + plan 外檔案偵測 + 零容忍門檻 (qualityIssues + suggestions >= 3)
- ✅ 測試: 67/67 passed, 0 regressions

---

## 6. 剩餘 Roadmap

### P1: state.json 整合 ✅
合併 state 為 state-manager-v3.cjs，支援斷點續傳。

### P2: 雙入口互通 — `--from-draft` ✅
POC Step 1 可讀取 Blueprint Enhanced Draft。

### P3: Blueprint loop.cjs 記憶整合 ✅
loop.cjs 接入 project-memory，雙引擎記憶統一。

### P4: @GUARD 可配置化 ✅
@GUARD 規則從 config.json 讀取，每個專案可自訂。

---

## 7. 產品形態願景

### Layer 1: MCP Server (核心，已有雛形)
把 task-pipe + sdid-tools 包成 MCP tools，任何支援 MCP 的 AI tool 都能呼叫。已有 GEMS Orchestrator MCP。

### Layer 2: CLI Extension (進階)
`sdid init` / `sdid run` / `sdid status`，npm install -g 就能用。

### Layer 3: IDE UI (遠期)
類似 Pencil.dev 的 canvas，視覺化 Blueprint 模組依賴圖、迭代規劃、BUILD 進度、Gate 狀態。

---

## 8. 核心原則 (從實戰提煉)

1. **腳本決定，AI 執行** — AI 不需要「理解全貌」才能修復。腳本告訴它 TARGET + MISSING + EXAMPLE，照做就好。
2. **資訊落差驅動行為** — 終端不印修復細節 → AI 必須讀 log → 修復品質提升。
3. **結構化記憶 > 語義記憶** — 「BUILD Phase 2, Story-1.0, MISSING: GEMS-FLOW」比「上次好像標籤有問題」有用 100 倍。
4. **最小變動原則** — 改輸出行為，不改函式簽名。改 output 欄位值，不改 step 的 require 方式。
5. **Gate 比記憶重要** — 記憶解決「記得住」，Gate 解決「做得對」。

---

## 9. 跟其他工具的定位差異

| 工具 | 做什麼 | SDID 的角色 |
|------|--------|------------|
| Cursor / Kiro / OpenCode | 生成程式碼 | SDID 定義驗收標準，AI tool 負責執行 |
| OpenClaw | 通用 AI 助手 + 語義記憶 | 不同賽道。SDID 用結構化記憶 + Gate |
| Devin / SWE-Agent | 自主 coding agent | SDID 可以是它們的 workflow layer |
| GitHub Copilot | 行內補全 | 無交集 |

核心差異: AI coding tools 解決「怎麼寫」，SDID 解決「寫什麼、怎麼驗、寫完了沒」。

---

## 10. 刻意不做的事

| 提案 | 為什麼不做 |
|------|-----------|
| Vector search / Embedding | SDID 的記憶是結構化的，精確查詢就夠用 |
| AI 自己決定記什麼 | 腳本已經知道該記什麼，不需要 LLM 判斷 |
| 獨立 CLI agent (`sdid run --auto`) | 工程量太大，跟現有 AI tools 重疊 |
| 跨專案記憶 | LLM 訓練資料 + steering file 已覆蓋 |
| Log JSON 化 | 增加複雜度，text log + @READ 已夠用 |

---

## 11. 開放問題 (適合討論)

1. **MCP Server 的 tool 粒度**: 每個 Phase/Step 一個 tool？還是只暴露 `run(phase, step)` 一個入口？
2. **Blueprint Flow 的 loop.cjs 自動化程度**: 目前是 skill 驅動 (ralph-loop / blueprint-loop)，要不要做成更獨立的 supervisor？
3. **state.json 的斷點續傳**: 如果 AI 對話中斷，重新開始時要自動從上次的 Phase/Step 繼續嗎？還是讓使用者手動指定？
4. **@GUARD 的粒度**: 目前是檔案路徑級別的禁止。要不要支援函式級別？(例如: 禁止修改 P0 函式)
5. **跨迭代的 Fillback 累積**: iter-1 的 suggestions 影響 iter-2 的展開，但 iter-2 的 suggestions 要不要回饋到藍圖的全局視圖？
6. **輸出協議的 Token 優化**: Phase 3 (Adaptive Prompt Repetition) 值不值得做？目前系統已能跑通，但 Token 消耗偏高。
7. **產品化的優先順序**: MCP Server (Layer 1) vs CLI (Layer 2) 先做哪個？MCP 生態更熱，但 CLI 更通用。

---

*SDID Master Plan v2.1 | 2026-02-16 | 基於 STRATEGY_ROADMAP v2.8 + Blueprint Evolution MASTER_PLAN v2.1 綜合*
