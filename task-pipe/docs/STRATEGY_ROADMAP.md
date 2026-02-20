# SDID 戰略藍圖 v2.8 (Strategy Roadmap)

> 更新日期: 2026-02-16
> v2.8 變更: Phase 2 全部完成 — P5 Quick Mode + P8 Plan 路徑驗證 + P7 Adversarial Review 併入 Phase 8
> v2.7 變更: Phase 2 路線圖定案 — 砍到只剩 3 項 (P5→P8→P7)。P6 棕地/P9 Correct-Course 暫緩。P10 project-context.json 砍掉，降級為 config.json 加三欄位搭 P8 順手做。P7 加入零容忍門檻 (BMAD Pattern A)。新增附錄 F (BMAD 深度分析第二輪)
> v2.6 變更: P5 Quick Mode 設計大幅更新 — 整合 ralph-loop skill 觸發、iter-quick 不佔序號、@RESUME 中斷續接機制、loop/runner 分工定義。新增附錄 E (loop vs runner 架構分工)
> v2.5 變更: 新增附錄 C.4 (BMAD 無 Gate 機制原因分析) + 附錄 D (BMAD Context Engineering 技巧分析與 SDID 適用性評估)
> v2.4 變更: 新增 Phase 2 路線圖 — 語意驅動方向 (Quick Mode / 棕地逆向工程 / Adversarial Review / Correct-Course)，來源: BMAD-METHOD 借鏡分析
> v2.3 變更: P1.5~P4 全部完成 — Plan Protocol、--from-draft、loop.cjs memory、@GUARD 可配置化
> v2.2 變更: P1.5 Plan Protocol 完成 — 雙引擎出口接入 plan-validator
> v2.1 變更: 新增架構審查結論、三層資料模型定義、health-report 工具、修正優先順序

---

## 1. SDID 是什麼、不是什麼

SDID 是一套 AI 開發流程管線。它的價值在於：用腳本驅動的 Gate 機制，把 AI 的隨機輸出約束成可預測的結構化產出。

它不是 AI coding tool（不生成程式碼），不是 IDE plugin（寄生在終端裡），也不是 orchestrator（不直接呼叫 LLM API）。它是一套「驗收協議」— 定義 AI 該做什麼、怎麼驗證、失敗了怎麼辦。

### 跟其他工具的關係

| 工具 | 做什麼 | SDID 的角色 |
|------|--------|------------|
| Cursor / Kiro / OpenCode | 生成程式碼 | SDID 定義驗收標準，AI tool 負責執行 |
| OpenClaw | 通用 AI 助手 + 記憶系統 | 不同賽道，但記憶設計值得參考 |
| GitHub Copilot | 行內補全 | 無交集 |
| Devin / SWE-Agent | 自主 coding agent | SDID 可以是它們的 workflow layer |

核心差異：AI coding tools 解決「怎麼寫」，SDID 解決「寫什麼、怎麼驗、寫完了沒」。

---

## 2. 已完成的事 (What's Done)

### 2.1 流程管線 (Task-Pipe)
- POC → PLAN → BUILD → SCAN 四階段管線 ✅
- Blueprint Flow (Gate → Plan → BUILD → Shrink → Expand → Verify) ✅
- 每個 Phase/Step 有獨立腳本 + Gate 驗證 ✅
- Level S/M/L 控制檢查深度 ✅

### 2.2 GEMS 標籤協議
- 函式級標籤 (GEMS/GEMS-FLOW/GEMS-DEPS/GEMS-TEST) ✅
- BUILD Phase 2 自動掃描驗收 ✅
- 契約設計 (@GEMS-CONTRACT + @GEMS-TABLE) ✅

### 2.3 輸出協議 v3.0 (2026-02-14 完成)
- Terminal Signal Only — 終端只印信號，細節存 log ✅
- @READ 機制 — 強制 AI 讀取 log 檔案 (Information Gap Strategy) ✅
- @GUARD 統一 — 4 種施工紅線合併為 1 種，減少 Token 消耗 ✅
- NEXT: 統一 — 消除「下一步/修復後/詳情」等同義詞，統一指令介面 ✅
- 雙引擎同步 — task-pipe + sdid-tools 輸出行為一致，共用 emit* 函式 ✅

### 2.4 策略漂移 (Strategy Drift)
- 三層漂移 (TACTICAL → STRATEGY_SHIFT → PLAN_ROLLBACK) ✅
- .strategy-state.json 追蹤重試次數 ✅
- .task-pipe/state.json 全域 tactical fix 計數 ✅

### 2.5 Health Report 工具 (2026-02-15 完成)
- `task-pipe/tools/health-report.cjs` — 跨專案事後分析工具 ✅
- 掃描所有專案的 logs + project-memory，產出系統級改善建議 ✅
- 熱點分析（哪個 phase/step 失敗最多）✅
- Story 效率分析（重試比）✅
- WARNING→BLOCKER 升級候選偵測 ✅
- 跨專案模式識別（HIGH/MEDIUM/LOW 嚴重度分級）✅
- 首次掃描結果: 13 專案 / 493 筆 log / BUILD-2 標籤驗收為最大系統性痛點 (30 次, 7 專案)

---

## 3. 架構審查結論 (2026-02-15)

> 來源: ChatGPT 架構師級審查 + Sonnet 4.5 補充 + 內部二次分析

### 3.1 外部審查提出的三個風險

| 風險 | 診斷 | 我們的判斷 |
|------|------|-----------|
| 1. 不是 Formal State Machine | state/memory/strategy 三個 source of truth | ✅ 正確。P1 (state 整合) 解決 |
| 2. implementation_plan 沒有 Schema | 雙引擎交會點是口頭約定 | ✅ 正確且最優先。新增 P0.8 |
| 3. 記憶系統需要 Decision Graph | 只有 phase/step 級別追蹤 | ❌ 過度設計。Gate 機制已防止因果鏈形成 |

### 3.2 風險 3 為什麼不做

ChatGPT 假設的因果鏈：`BUILD 爆炸 ← PLAN 設錯 ← POC 契約錯 ← Blueprint 決策錯`

但在 SDID 裡，每一層 Gate 都是 BLOCKER 級別：
- POC Step 5 有 Gate → 契約錯不會進 PLAN
- PLAN Step 3 有架構審查 → 設計錯不會進 BUILD
- BUILD Phase 1 有骨架檢查 → 結構錯不會進 Phase 2

Gate 機制本身就是「防止因果鏈形成」的設計。因果追蹤是「錯誤已傳播」後的補救，Gate 是「錯誤還沒傳播」前的預防。我們選的是預防路線。

如果有 WARNING 級別的問題穿透 Gate，正確做法是：審查 WARNING 項目，把該升級成 BLOCKER 的升上去。health-report 的 UPGRADE_CANDIDATE 機制就是做這件事。

### 3.3 三層資料模型（正式定義，v4.0 更新）

```
┌─────────────────────────────────────────────────────────┐
│  STATE (狀態機) — 單一真相來源                            │
│  位置: .gems/iterations/iter-X/.state.json              │
│  職責: 「現在在哪、重試幾次了、策略漂移到哪層」             │
│  讀寫: runner.cjs 啟動時讀、step 結束時寫                 │
│  內容:                                                   │
│    flow: { currentNode, entryPoint }  ← 流程游標         │
│    tacticalFixes: { ... }             ← 重試計數 (原全域) │
│    strategy: { nodes, stats }         ← 策略漂移 (原獨立) │
│    stories: { ... }                   ← Story 追蹤       │
│    retries: { ... }                   ← 重試追蹤         │
├─────────────────────────────────────────────────────────┤
│  LOG (任務接收機)                                        │
│  位置: .gems/iterations/iter-X/logs/*.log               │
│  職責: 「這次具體錯什麼、怎麼修」                          │
│  讀寫: 腳本寫、AI 透過 @READ 讀                          │
│  內容: @TASK, @CONTEXT, 修復指引, 範例                    │
├─────────────────────────────────────────────────────────┤
│  MEMORY (記憶彙總)                                       │
│  位置: .gems/project-memory.json                        │
│  職責: 「歷史上哪裡容易出問題」                            │
│  讀寫: 腳本 append、runner 啟動時讀 (@MEMORY/@PITFALL)    │
│  內容: entries[], knownPitfalls[], @HINT                 │
└─────────────────────────────────────────────────────────┘

P1 完成後: STATE 從 3 個檔案合併為 1 個。
讀寫時機不重疊，職責正交，不會衝突。
STATE 是游標，LOG 是細節，MEMORY 是趨勢。
```

---

## 4. 下一步：務實的優先順序

### P0: project-memory 接入 runner.cjs ✅ (2026-02-14 完成)
- runner.cjs 啟動時呼叫 `getResumeContext()` 印出 `@MEMORY` ✅
- 每個 step 執行完呼叫 `recordEntry()` 記錄結果 ✅
- log-output.cjs 的 `anchorError` 加入 `@HINT`（呼叫 `getHistoricalHint()`）✅
- 測試: 13/13 passed ✅

### P0.5: 輸出對齊強化 ✅ (2026-02-15 完成)

Phase 1 — 函式整併 ✅: 新增 4 個統一 emit 函式（emitPass / emitFix / emitFill / emitBlock），雙引擎同步。測試: 44/44 passed。

Phase 2 — Step 標準化 ✅ (2026-02-15):
- ✅ BUILD Phase 1-8: anchorErrorSpec→emitFix, anchorPass→emitPass, anchorError(blocker)→emitBlock
- ✅ POC Step 1-5 / PLAN Step 1-5 / SCAN: import 更新（emit* 可用）
- ✅ runner.cjs: 修復 projectMemory require (CRLF 問題)
- ⏳ anchorOutput (複雜多區塊引導) 保留不動，風險太高
- 測試: 57/57 passed, todo-app 實測 OK

Phase 3 — Token 優化: 視實際痛點決定是否執行。

### P0.8: Health Report + Plan Schema (2026-02-15 完成)

**已完成:**
- ✅ `task-pipe/tools/health-report.cjs` — 跨專案事後分析
- ✅ 首次掃描: 13 專案 / 493 筆 log / 識別 8 個 HIGH 級系統性問題
- ✅ `task-pipe/lib/plan/plan-validator.cjs` — Plan Schema 驗證器
- ✅ 驗證項: H1 Story ID、Story ID 欄位一致性、§3 工作項目表格、§4 GEMS 標籤、檔案路徑、Priority 值
- ✅ 接入 BUILD Phase 1 — plan 格式不合直接 BLOCKER，不進 BUILD
- ✅ 全部 3 個真實專案 (todo-app, bookmark-app, recipe-manager) 驗證通過
- ✅ `health-report --inject` — HIGH/UPGRADE_CANDIDATE 建議注入 project-memory knownPitfalls
- ✅ 去重機制 + pitfall 上限 10 筆 + [HEALTH] 前綴標記
- ✅ AI 透過已有的 @PITFALL 管道自然接收，不改 log-output、不改 state、不改 runner

### P1: state.json 整合 (2026-02-15 完成)

三個 source of truth 統一為 `.gems/iterations/iter-X/.state.json`：

| 原位置 | 原內容 | 新位置 |
|--------|--------|--------|
| `.task-pipe/state.json` (全域) | tacticalFixes 計數器 | `.state.json` → `tacticalFixes` |
| `.gems/iterations/iter-X/.strategy-state.json` | 策略漂移追蹤 | `.state.json` → `strategy` |
| `.gems/iterations/iter-X/.state.json` | 流程游標/重試/Story | `.state.json` (原地不動) |

變更：
- ✅ `state-manager-v3.cjs` v4.0: `incrementTacticalFix` 等寫入 iteration state
- ✅ `retry-strategy.cjs` v4.0: 讀寫 `.state.json` 的 `strategy` 欄位（向後相容舊格式）
- ✅ `runner.cjs`: 修復重複的 `projectMemory` 宣告和重複的 `@MEMORY` 印出
- ✅ 所有外部 API 簽名不變（零破壞性變更）
- ✅ 整合測試: todo-app BUILD Phase 1-2 正常運作

### P1.5: Plan Protocol — 中間層協定化 (2026-02-15 完成)

implementation_plan 是雙引擎的 ABI (Application Binary Interface)。P0.8 建了驗證器，P1.5 把它正式接入雙引擎的出口：

- ✅ `task-pipe/docs/plan-schema.md` — 人類可讀的 Schema 文件，9 條規則
- ✅ `sdid-tools/draft-to-plan.cjs` — Blueprint 引擎出口加入 plan-validator (WARNING 級)
- ✅ `task-pipe/phases/plan/step-5.cjs` — Task-Pipe 引擎出口加入 plan-validator (WARNING 級)
- ✅ BUILD Phase 1 入口維持 BLOCKER 級 (P0.8 已完成)

驗證層級設計：
| 觸發點 | 嚴重度 | 理由 |
|--------|--------|------|
| draft-to-plan 出口 | WARNING | 修復責任在模板，不在使用者 |
| step-5 出口 | WARNING | 同上，提早提醒但不阻擋 |
| BUILD Phase 1 入口 | BLOCKER | 最後防線，格式不合不進 BUILD |

### P2: 雙入口互通 — POC Step 1 支援 `--from-draft` (2026-02-15 完成)

打通 Blueprint Flow → Task-Pipe Flow 的切換路徑：

- ✅ `runner.cjs` 新增 `--from-draft=<path>` 參數解析，傳遞給 step
- ✅ `step-1.cjs` 新增 `convertEnhancedDraftToRequirementDraft()` — 從 Enhanced Draft 提取需求
- ✅ 使用 `draft-parser-standalone.cjs` 解析活藍圖（零重複實作）
- ✅ 轉換保留：族群識別、共用/獨立模組、路由結構、實體定義、功能清單、釐清項目
- ✅ 轉換後繼續正常 step-1 驗證流程（checkDraft → autoPromote）
- ✅ 實測：ecotrack Enhanced Draft → requirement_draft → @PASS

用法：
```bash
node task-pipe/runner.cjs --phase=POC --step=1 --target=<project> --from-draft=<enhanced-draft.md>
```

### P3: Blueprint Flow 的 loop.cjs 整合 (2026-02-15 完成)

blueprint-loop 的 loop.cjs 接入 project-memory：

- ✅ 啟動時印出 `@MEMORY` resume context（跟 runner.cjs 一致）
- ✅ 每次執行完記錄結果到 project-memory（PASS/ERROR）
- ✅ COMPLETE 階段也記錄
- ✅ sdid-tools 的 GATE/PLAN/SHRINK/VERIFY 結果透過 loop.cjs 間接寫入 project-memory
- ✅ BUILD 階段走 runner.cjs，runner.cjs 已有 project-memory（不重複）
- ✅ project-memory require 失敗不影響主流程（graceful degradation）

注意：ralph-loop 不需要改，因為它呼叫 runner.cjs，runner.cjs 已有 project-memory。

### P4: @GUARD 可配置化 (2026-02-15 完成)

@GUARD 施工紅線從 hardcode 改為可配置：

- ✅ `task-pipe/lib/shared/log-output.cjs` — 新增 `setGuardRules()` / `getGuardLine()` / `getGuardLogLine()`
- ✅ `sdid-tools/lib/log-output.cjs` — 同步新增相同 API
- ✅ 兩個 log-output.cjs 中所有 hardcoded @GUARD 替換為函式呼叫 (task-pipe: 13 處, sdid-tools: 11 處)
- ✅ `task-pipe/config.json` — 新增 `output.guard` 配置區段
- ✅ `runner.cjs` — 啟動時從 config 讀取 guard 規則並注入
- ✅ 預設值不變 (`task-pipe/ sdid-tools/`)，零破壞性變更

配置範例：
```json
{
  "output": {
    "guard": {
      "forbidden": "framework/ tools/",
      "allowed": "app files"
    }
  }
}
```

---

## 5. 記憶系統：現狀與方向

### 5.1 競品研究：OpenClaw 的記憶架構

OpenClaw 是目前 AI agent 記憶系統做得最完整的開源專案。它的設計：

**三層記憶：**
- `MEMORY.md` — 長期策展記憶，AI 自己決定什麼值得記住
- `memory/YYYY-MM-DD.md` — 每日 append-only log，自動載入今天+昨天
- `sessions/YYYY-MM-DD-<slug>.md` — 對話存檔，可搜尋

**殺手級功能：Memory Flush**
- Context window 快爆時，自動觸發一輪讓 AI 把重要東西寫到 MEMORY.md
- 防止「對話太長 → 壓縮 → 丟失重要 context」

**OpenClaw 的限制：**
- 記憶是「AI 自己決定記什麼」— 品質取決於 LLM 的判斷力
- 語義搜尋對結構化流程資料是殺雞用牛刀
- 記憶解決「記得住」，但不解決「做得對」— 這正是 SDID Gate 機制的價值

### 5.2 SDID 記憶系統設計 (project-memory)

已實作 `task-pipe/lib/shared/project-memory.cjs`，設計原則：

**File-first, JSON-structured, script-driven:**
- 存放: `{project}/.gems/project-memory.json`
- 寫入: 腳本自動 append（不靠 AI 判斷）
- 讀取: runner.cjs 啟動時印 `@MEMORY` resume
- 裁剪: 超過 200 筆自動刪舊的

**功能：**
```
recordEntry()      — 每次 Phase/Step 執行完自動記錄 verdict + summary
getResumeContext() — 新對話開始時，印出最近 5 筆記錄 + pitfall
getHistoricalHint() — 查詢同 phase/step 的歷史錯誤，產出 @HINT
```

**刻意不做的：**
- Vector search / embedding — 殺雞用牛刀
- AI 自己決定記什麼 — 腳本已經知道該記什麼
- Decision Graph / 因果圖 — Gate 已防止因果鏈形成，不需要事後追蹤
- 跨專案記憶 — 目前沒有實際需求

---

## 6. 雙入口整合：Vibe 導向 × 規格導向

### 6.1 兩條路線，同一個目的地

```
路線 A (Blueprint Flow / Vibe 導向):
  Gem 對話 → Enhanced Draft → Gate → draft-to-plan → BUILD

路線 B (Task-Pipe Flow / 規格導向):
  requirement_draft → POC Step 1-5 → PLAN Step 1-5 → BUILD
```

兩條路線的入口體驗完全不同，但目的地一樣：產出 implementation_plan → 進入 BUILD Phase 1-8。
BUILD 不需要知道你從哪條路來的，它只看 plan 的格式對不對。

### 6.2 整合方向

整合不是合併，而是共享產物格式和 Gate 標準：
- 兩條路線產出的 implementation_plan 格式完全一致
- P0.8 的 Plan Schema 驗證確保這個一致性
- P2 的 `--from-draft` 已打通兩條路線的切換 ✅

### 6.3 長期產品形態

```
Layer 1: MCP Server (核心) — 已有 GEMS Orchestrator MCP 雛形
Layer 2: CLI Extension — sdid init / sdid run / sdid status
Layer 3: IDE UI (遠期) — 視覺化 Blueprint + BUILD 進度
```

---

## 7. Phase 2 路線圖：語意驅動方向

> 來源: BMAD-METHOD 借鏡分析 + 實戰痛點 (2026-02-15)
> 原則: 每項都是「小改動、高回報」，不重構既有架構

### 7.1 P5: Quick Mode — 小步快跑 ✅

**痛點**: 一個 bug fix 也要跑 POC→PLAN→BUILD 8 個 Phase，摩擦太大。而且必須手動 key「ralph loop」才能啟動自動流程。
**靈感**: BMAD 的 Quick Flow (quick-spec → quick-dev) 有升級門檻機制，自動判斷該走輕量還是全流程。

**設計 (v2，2026-02-16 討論定案)**:

#### 觸發機制 — 語意關鍵詞 + Skill 路由

不建新 skill，擴展 ralph-loop 的 SKILL.md triggers：

```
現有: "Ralph Loop", "自動開發", "繼續開發", "run loop", ...
新增: "ralph 小修", "快速修", "quick fix", "小步快跑"
```

AI 透過 agent-prompt.md 的規則判斷 mode：
- 用戶提到「小修」「quick」「快速」「修一下」→ `--mode=quick`
- 其他情況 → 預設 `--mode=full`（全流程）

即使 AI 判斷錯了也有 gate 兜底：小修當全流程跑 → 多跑幾個 phase，不壞東西。大改動當小修跑 → Phase 2/5 會 BLOCKER，自然擋住。

#### 語意路由表

```
你說「ralph loop」「開發 todo-app」     → ralph-loop skill → loop.cjs --mode=full
你說「ralph 小修」「快速修 todo-app」   → ralph-loop skill → loop.cjs --mode=quick
你說「blueprint」「藍圖」               → blueprint-loop skill → loop.cjs
你說其他                                → vibe，沒有 skill
```

#### Quick Mode 流程

```
loop.cjs --mode=quick --project=<path>
  → 建立 iter-quick-NNN（不佔正式 iter 序號）
  → AI 產精簡版 implementation_plan（一個 Story）
  → PLAN-5 (plan-validator 驗證格式)
  → BUILD Phase 1 (骨架確認 plan 合法)
  → AI 寫 code
  → BUILD Phase 2 (標籤驗收)
  → BUILD Phase 5 (測試執行)
  → BUILD Phase 7 (整合檢查)
  → 完成，不進下一個 iteration
```

門控: **PLAN-5 → BUILD 1,2,5,7**。五個 gate，夠嚴謹但不囉嗦。
Phase 4 (Test Gate) 省略 — Phase 5 跑測試時自然會爆。

#### iter-quick 不佔序號

```
.gems/iterations/
  iter-1/          ← 正式
  iter-2/          ← 正式
  iter-quick-001/  ← 小修，跑完歸檔
  iter-quick-002/  ← 小修，跑完歸檔
  iter-3/          ← 正式，接 iter-2
```

plan 和 log 還是會存（可追溯），但不佔 iter-N 的序號。

#### loop vs runner 分工

```
loop.cjs = 導航（讀 state，告訴 AI 下一步是什麼）
runner.cjs = 引擎（實際跑 phase 腳本，產出 @PASS/@BLOCKER）
```

loop 不跑驗證邏輯，只印 `@NEXT_COMMAND`。runner 是 stateless 的 — 給它 `--phase --step --target`，它跑完寫 state。兩者共享 `.state.json` 這個真相來源。

手動和自動可以混用：
- 手動: 你自己跑 `runner.cjs --phase=BUILD --step=2 --target=./todo-app`
- 自動: AI 跑 `loop.cjs` → 讀 `@NEXT_COMMAND` → 跑 `runner.cjs` → 再跑 `loop.cjs` → 循環
- 混用: 一個專案手動、另一個自動，互不干擾（每個專案有自己的 .state.json）

#### @RESUME — 中斷續接

loop.cjs 啟動時偵測未完成的 phase，印精確續接指令：

```
@RESUME: BUILD Phase 3, Story-1.0 (中斷於 2026-02-16T10:30)
@NEXT_COMMAND: node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0 --target=./todo-app
```

中途插入處理（steering 規則）：
- AI 正在跑 ralph-loop 流程中，使用者插入不相關請求 → 先完成當前 phase 修復循環再處理
- 使用者堅持 → 暫停流程，提醒「BUILD Phase 3 進行中，處理完你的請求後我會繼續」
- 處理完後說「ralph 繼續」→ loop.cjs 讀 state → @RESUME → 從斷點接

#### 實作範圍

| 檔案 | 改動 | 行數 |
|------|------|------|
| `runner.cjs` | 新增 `--quick` flag，路由到 Phase [1,2,5,7] 子集 | ~30 行 |
| `ralph-loop/scripts/loop.cjs` | 新增 `--mode=quick`，用 iter-quick-NNN，精簡 gate | ~40 行 |
| `ralph-loop/scripts/loop.cjs` | 啟動時偵測未完成 phase，印 `@RESUME` | ~15 行 |
| `ralph-loop/SKILL.md` | triggers 加「ralph 小修」「quick fix」「小步快跑」 | 3 行 |
| `ralph-loop/references/agent-prompt.md` | 加 quick 模式判斷 + 中斷處理規則 | ~15 行 |
| `.kiro/steering/task-pipe-flow.md` | 加中途插入處理規則 | 5 行 |

總計 ~110 行改動，沒有新檔案，沒有新機制。全部在現有 ralph-loop + runner.cjs 上加路由。

### 7.2 P6: 棕地逆向工程 — SCAN→Spec 反向產出 🔒 暫緩

> 暫緩原因: 目前沒有棕地接入的實際需求。所有測試專案 (todo-app, bookmark-app, recipe-manager) 都是綠地。等有真實棕地專案需求時再啟動。棕地 config 三欄位 (srcDir/testPattern/testCommand) 已搭 P8 順手加入 config.json，不需要獨立做。

**痛點**: 既有專案想接入 SDID，但沒有 requirement_draft / implementation_plan。手動補寫太痛苦。
**使用者洞察**: 用 gems-validator 掃描既有程式碼 → 補全 GEMS 標籤 → 從標籤反向產出規格文件。

**設計 (三步走)**:
```
Step 1: SCAN --brownfield → 掃描既有程式碼，產出 functions.json (已有)
Step 2: AI 根據 functions.json 補全 GEMS 標籤 (BUILD Phase 2 已有能力)
Step 3: 新工具 spec-reverse-generator → 從 functions.json 反向產出:
  - requirement_spec_iter-X.md (功能清單 + 已驗證標記)
  - implementation_plan_Story-X.Y.md (每個模組一個 Story)
```

**實作範圍**:
- `scan.cjs` 新增 `--brownfield` flag — 掃描時額外產出「未標籤函式清單」+ 建議 Priority
- 新工具 `spec-reverse-generator.cjs` — 讀取 functions.json + tech-stack.json，產出 plan 骨架

**棕地接入流程**:
```
既有專案 → SCAN --brownfield → AI 補標籤 → SCAN (正式) → spec-reverse-generator
  → 產出 requirement_spec + implementation_plan
  → 進入正常 BUILD 流程（iter-2 開始新功能）
```

### 7.3 P7: Adversarial Self-Review — 併入 Phase 8，強化 suggestions 產出 ✅

**痛點**: BUILD Phase 8 的 `iteration_suggestions` 裡 `suggestions[]` 和 `technicalDebt[]` 完全靠 AI 自覺填寫，腳本只驗「有沒有」不驗「夠不夠」。AI 容易走過場，寫兩條敷衍了事。
**靈感**: BMAD 的 adversarial review — 強制找 3-10 個問題，零容忍門檻。

**設計 (併入 Phase 8，不加新 Phase)**:

Phase 8 現有流程:
```
掃描 GEMS 標籤 → 自動填 completedItems/tagStats
→ AI 手動填 technicalHighlights/technicalDebt/suggestions
→ 驗證格式 → 可執行性驗證 → Smoke Test → PASS
```

P7 強化後的流程:
```
掃描 GEMS 標籤 → 自動填 completedItems/tagStats
→ 腳本自動跑對抗式檢查 (新增):
  1. 假實作偵測: 掃描 ✓✓ 函式的 body，找 TODO/throw/not-implemented
  2. AC 覆蓋檢查: plan AC vs 實際測試，找出「AC 沒被測試覆蓋」的項目
  3. plan 外檔案偵測: 改了但不在 plan FILE 裡的檔案
  4. STEP 錨點一致性 (已有)
→ 自動產出的 findings 寫入 qualityIssues[]
→ AI 手動填 technicalHighlights/technicalDebt/suggestions
→ 零容忍門檻: qualityIssues + suggestions 合計 >= 3，否則 FAIL
→ 可執行性驗證 → Smoke Test → PASS
```

**零容忍門檻 (BMAD Pattern A 借鏡)**:
- `qualityIssues[]`（腳本自動找）+ `suggestions[]`（AI 手動填）合計最少 3 個
- 不到 3 個 → Phase 8 FAIL，要求 AI 補充改善建議
- 原理: 防止 AI 的「確認偏誤」— 自己寫的程式碼自己 review 容易放水
- 腳本先自動找一輪硬指標，AI 再補軟性建議，合力湊到門檻
- findings 分級: CRITICAL (必修) / WARNING (建議修) / INFO (記錄)
- CRITICAL → Phase 8 BLOCKER（假實作必須修完才能過）
- WARNING/INFO → 寫入 `iteration_suggestions` 的 `qualityIssues`，給下次 iteration 參考

**為什麼併入 Phase 8 而不是新增 Phase 8.5**:
- Phase 8 已有 `qualityIssues[]` 欄位（目前只查 STEP 錨點），P7 是擴展檢查範圍
- 不加新 Phase = 不動 runner.cjs 路由、不動 loop.cjs state 判斷、不動 Quick Mode Phase 子集
- 收尾 + 自我審查本來就是同一件事
- 之後真的太胖再抽 `adversarial-checker.cjs` 工具出來就好

**實作範圍**:

| 檔案 | 改動 | 行數 |
|------|------|------|
| `phase-8.cjs` | `autoGenerateOutputs()` 加入對抗式檢查邏輯 | ~50 行 |
| `phase-8.cjs` | 驗證邏輯加入零容忍門檻 (qualityIssues + suggestions >= 3) | ~15 行 |
| `phase-8.cjs` | CRITICAL findings → BLOCKER 路徑 | ~15 行 |
| `gems-validator.cjs` | 擴展 `detectFraud()` — 加入 AC 覆蓋檢查 + plan 外檔案偵測 | ~30 行 |

總計 ~110 行，全部在現有檔案上改，沒有新檔案、沒有新 Phase。

**iteration_suggestions 新增欄位範例**:
```json
{
  "qualityIssues": [
    { "type": "FRAUD_DETECT", "severity": "CRITICAL", "function": "calculateTotal", "message": "body contains TODO" },
    { "type": "AC_UNCOVERED", "severity": "WARNING", "ac": "AC-3: 錯誤處理", "message": "無對應測試" },
    { "type": "UNPLANNED_FILE", "severity": "INFO", "file": "src/utils/temp-hack.ts", "message": "不在 plan FILE 欄位中" }
  ],
  "suggestions": [
    { "id": "SUG-1", "type": "REFACTOR", "description": "...", "priority": 1 }
  ]
}
```

### 7.4 P8: Plan 檔案路徑驗證 — BUILD Phase 1 強化 ✅

**痛點**: AI 在 PLAN 階段寫了不存在的檔案路徑（§3 工作項目的 FILE 欄位），BUILD 時才發現。
**靈感**: BMAD 的 `validate-file-refs.js` 掃描所有檔案引用，驗證目標存在。

**設計**:
- BUILD Phase 1 新增: 掃描 plan 裡所有 FILE 欄位
- 已存在的路徑 → ✅
- 不存在但在 plan 的「新建檔案」清單裡 → ✅ (標記為「待建立」)
- 不存在且不在新建清單 → ⚠️ WARNING (可能是 AI 幻覺路徑)
- 接入 plan-validator.cjs 作為新規則 (Rule 9+)

### 7.5 P9: Correct-Course — 需求變更處理 🔒 暫緩

> 暫緩原因: 低頻場景，目前開發流程中還沒遇到「iteration 內需求變更」的實際痛點。Strategy Drift 已處理「重試」，Blueprint Flow 的 EXPAND 已處理「新增 iteration」。等有真實需求再啟動。

**痛點**: Strategy Drift 只處理「重試」(同一個目標反覆失敗)，不處理「需求變更」(目標本身要改)。
**靈感**: BMAD 的 correct-course workflow — 6 步分析流程，評估變更影響，產出變更提案。

**設計**:
```
runner.cjs --phase=PLAN --change-request --target=<project>
  → 讀取現有 plan + 使用者描述的變更
  → 影響分析: 哪些 Story 受影響、哪些檔案要改
  → 產出 change-proposal.md (變更前/後對比)
  → 使用者確認後，更新 plan + 重新進入 BUILD
```

**與現有機制的關係**:
- Blueprint Flow 的 EXPAND 已處理「新增 iteration」— P9 處理「iteration 內的變更」
- Fillback 的 iteration_suggestions 已記錄「建議改什麼」— P9 是「正式執行改」

### 7.6 P10: ~~project-context.json~~ → config.json 棕地三欄位 (搭 P8 順手做) ✅ 降級

> 原設計砍掉原因: project-context.json 是假議題。LLM 透過 IDE 已經會自己掃全域，SDID 腳本已經在驗證 conventions。BMAD 需要 project-context.md 是因為它沒有 runtime 腳本，只能靠 prompt 注入。SDID 有 .cjs 腳本，不需要額外的 context 注入層。

**降級方案**: 在 `task-pipe/config.json` 加三個棕地欄位，搭 P8 (Plan 路徑驗證) 順手做：

```json
{
  "project": {
    "srcDir": "src",
    "testPattern": "**/*.test.ts",
    "testCommand": "npx vitest --run"
  }
}
```

- `srcDir`: BUILD Phase 2 掃描標籤時用（目前 hardcode `src`）
- `testPattern`: BUILD Phase 4/5 找測試檔案時用
- `testCommand`: BUILD Phase 5 跑測試時用（目前 hardcode `npx vitest --run`）

三個欄位，P8 改 plan-validator 時順手讀 config，零額外工程量。

---

### Phase 2 優先順序 (v2.8 完成)

| 順序 | 編號 | 名稱 | 價值 | 工程量 | 狀態 |
|------|------|------|------|--------|------|
| 1st | P5 | Quick Mode | 🔴 高 (日常最大摩擦) | S (~110 行) | ✅ 完成 |
| 2nd | P8 | Plan 路徑驗證 + config 三欄位 | 🟡 中 (防 AI 幻覺 + 棕地基礎) | S (~40 行) | ✅ 完成 |
| 3rd | P7 | Adversarial Review (併入 Phase 8) | 🟡 中 (品質提升) | M (~110 行) | ✅ 完成 |
| — | P6 | 棕地逆向工程 | � 暫緩 | — | 無實際需求 |
| — | P9 | Correct-Course | � 暫緩 | — | 低頻場景 |
| — | P10 | ~~project-context.json~~ | ❌ 砍掉 | — | 假議題，降級為 P8 附帶 |

總工程量: ~260 行，3 個項目。Phase 2 全部完成 (2026-02-16)。

---

## 8. 中期方向 (原 §7)

### 8.1 MCP Server 強化 (Layer 1)
- 把 Blueprint Gate / Draft-to-Plan / POC Step 1-5 / BUILD Phase 1-8 都包成 MCP tools

### 8.2 Supervisor Mode (透過 Skill)
- 利用現有的 ralph-loop / blueprint-loop skill
- Skill 本身就是 supervisor — 讀腳本輸出、決定下一步、指揮 AI 修復

---

## 9. 不做的事（以及為什麼）

| 提案 | 為什麼不做 |
|------|-----------|
| Vector search / Embedding | SDID 的記憶是結構化的，精確查詢就夠用 |
| Decision Graph / 因果圖 | Gate 已防止因果鏈形成，追蹤是多餘的 |
| Formal State Machine (TypeScript typed) | 過度工程。P1 state 整合已解決三個 source of truth 問題，單一 .state.json 是唯一真相來源 |
| 獨立 CLI agent (`sdid run --auto`) | 工程量太大，跟現有 AI tools 重疊 |
| 跨專案記憶 | LLM 訓練資料 + steering file 已覆蓋 |
| Log JSON 化 | 增加複雜度，text log + @READ 已夠用 |

---

## 10. 核心原則（從實戰提煉）

**原則 1: 腳本決定，AI 執行**
AI 不需要「理解全貌」才能修復。腳本告訴它 TARGET + MISSING + EXAMPLE，它照做就好。

**原則 2: 資訊落差驅動行為**
終端不印修復細節 → AI 必須讀 log → 修復品質提升。

**原則 3: 結構化記憶 > 語義記憶**
「BUILD Phase 2, Story-1.0, MISSING: GEMS-FLOW」比「上次好像標籤有問題」有用 100 倍。

**原則 4: 最小變動原則**
改輸出行為，不改函式簽名。改 output 欄位值，不改 step 的 require 方式。

**原則 5: Gate 比記憶重要**
記憶解決「記得住」，Gate 解決「做得對」。SDID 的核心價值在 Gate，不在記憶。

**原則 6: 預防優於追蹤 (v2.1 新增)**
Gate 是「防止錯誤傳播」的預防機制。因果追蹤是「錯誤已傳播」後的補救。選預防路線，追蹤就是多餘的。如果有 WARNING 穿透 Gate，正確做法是升級為 BLOCKER，不是建因果圖。

---

## 附錄 A: 競品記憶系統比較

| 維度 | OpenClaw | Cursor Rules | AGENTS.md | SDID |
|------|----------|-------------|-----------|------|
| 記憶類型 | 語義 (embedding) | 靜態規則 | 靜態規則 | 結構化 (JSON) |
| 誰寫入 | AI 自己 | 人類 | 人類 | 腳本自動 |
| 搜尋方式 | Hybrid (vector+BM25) | 全文注入 prompt | 全文注入 prompt | 精確路徑查詢 |
| 驗收機制 | ❌ 無 | ❌ 無 | ❌ 無 | ✅ Gate + Phase |

## 附錄 B: Health Report 首次掃描結果 (2026-02-15)

13 專案 / 493 筆 log / 主要發現:

| 嚴重度 | Phase/Step | 累計錯誤 | 影響專案數 | 建議 |
|--------|-----------|---------|-----------|------|
| 🔴 HIGH | BUILD-2 (標籤驗收) | 30 | 7 | emitFix 的 GEMS 標籤範例需加強 |
| 🔴 HIGH | BUILD-1 (骨架檢查) | 17 | 5 | PLAN 階段加入 scaffold 驗證 |
| 🔴 HIGH | GATE-check | 13 | 5 | Enhanced Draft 模板引導不足 |
| 🔴 HIGH | BUILD-4 (Test Gate) | 11 | 3 | Phase 3 加入 import 路徑驗證 |
| 🔴 HIGH | POC-4 | 10 | 3 | POC 原型驗證引導需加強 |
| 🟡 UPGRADE | BUILD-8:PENDING | 5 | 3 | 考慮升級為 BLOCKER |
| 🟠 MEDIUM | PLAN-4 | 10 | 1 | 單一專案高頻失敗 |


## 附錄 C: BMAD-METHOD 借鏡分析 (2026-02-15)

> 來源: `github_project/BMAD-METHOD-main/` 本地分析

### BMAD 架構概覽

BMAD 是一套 AI agent workflow 框架，有兩條路線：
- Full Planning Path: product-brief → PRD → architecture → epics → sprint → dev-story → code-review
- Quick Flow: quick-spec (4 步) → quick-dev (6 步) — 小修改專用

### 值得借鏡的設計

| BMAD 機制 | 對應 SDID 方向 | 借鏡重點 |
|-----------|---------------|---------|
| Quick Flow 升級門檻 | P5 Quick Mode | 信號計數判斷複雜度，自動路由到輕量/全流程 |
| project-context.md | P10 project-context.json | 每個 workflow 啟動都載入，作為所有決策基礎 |
| correct-course workflow | P9 Correct-Course | 6 步影響分析 + 變更提案，處理 sprint 中途變更 |
| adversarial code review | P7 Adversarial Review | 強制找 3-10 個問題，diff baseline，假實作偵測 |
| validate-file-refs.js | P8 Plan 路徑驗證 | 掃描所有檔案引用，驗證目標存在 |
| dev-story red-green-refactor | (已有 BUILD Phase 3-5) | TDD 循環，SDID 已覆蓋 |
| sprint-status.yaml | (已有 .state.json) | 狀態追蹤，SDID 用 JSON 更精確 |
| retrospective workflow | (已有 Fillback + health-report) | 回顧機制，SDID 用腳本自動化更好 |

### BMAD 的限制 (SDID 已超越的部分)

- BMAD 沒有 Gate 機制 — 靠 checklist 人工驗證，不是腳本強制 BLOCKER
- BMAD 沒有結構化記憶 — 靠 story file 的 Dev Agent Record，不是 project-memory.json
- BMAD 沒有策略漂移 — 失敗就 HALT，沒有 TACTICAL→STRATEGY_SHIFT→PLAN_ROLLBACK
- BMAD 的 workflow 是 YAML/XML prompt — SDID 的 Phase 是可執行的 .cjs 腳本，驗證更精確
- BMAD 沒有跨專案分析 — SDID 的 health-report 可以掃描 13+ 專案找系統性問題

### 為什麼 BMAD 沒有 Gate 機制 — 設計哲學分析

> 來源: README.md、adversarial-review.md、preventing-agent-conflicts.md、workflow.xml

**BMAD 的定位聲明** (README):
> "Traditional AI tools do the thinking for you, producing average results. BMad agents act as expert collaborators who guide you through a structured process to bring out your best thinking."

這句話揭示了根本差異：BMAD 是「人類引導型」，SDID 是「腳本驗證型」。

**具體證據：BMAD 的「Gate」是人類 checkpoint，不是腳本**

| BMAD 機制 | 運作方式 | SDID 對應 |
|-----------|---------|-----------|
| workflow.xml 的 `template-output` tag | 每個段落完成後暫停，等人類選 [A]/[P]/[C]/[Y] | Phase 腳本自動跑，@PASS/@BLOCKER 決定 |
| adversarial review | 產出 findings 清單，但明確說 "Human Filtering Required" — 人類決定哪些是真問題 | gems-validator 的 detectFraud() 直接 BLOCKER |
| preventing-agent-conflicts | 靠 Architecture ADR 文件讓多 agent 保持一致，不靠腳本強制 | BUILD Phase 7 整合檢查腳本 |
| step-file 的 verification checklist | 寫在 markdown 裡的 `[ ]` 清單，AI 自己勾選 | plan-validator.cjs 程式化驗證 |
| quick-spec 的 WIP resume | frontmatter `stepsCompleted` 陣列，但沒有驗證「完成品質」 | .state.json + Gate verdict |

**為什麼 BMAD 選擇不做自動 Gate？推測三個原因：**

1. **目標受眾不同**: BMAD 有 `user_skill_level` 配置（支援非技術使用者），設計上假設人類全程參與。SDID 假設 AI 自主執行，人類監督最小化 — 所以需要腳本當守門員。

2. **信任模型不同**: BMAD 信任人類是最終裁判（"You decide what's real"），所以 adversarial review 的 false positive 不是問題。SDID 信任腳本是最終裁判（@BLOCKER 不可繞過），所以 false positive 必須最小化。

3. **執行模型不同**: BMAD 的 workflow.xml 是 prompt engineering — 用 XML tag 指導 LLM 行為，本質是「建議」。SDID 的 .cjs 腳本是程式碼 — 用 process.exit(1) 強制停止，本質是「命令」。Prompt 可以被 LLM 忽略，process.exit 不行。

**結論**: BMAD 不是「缺少」Gate，而是刻意選擇了不同的驗證路線。兩者的取捨：

| 維度 | BMAD (人類 checkpoint) | SDID (腳本 Gate) |
|------|----------------------|-----------------|
| 適用場景 | 人類全程參與的協作開發 | AI 自主執行的管線化開發 |
| 驗證精度 | 取決於人類判斷力 | 取決於腳本規則完整度 |
| 擴展性 | 人類是瓶頸 | 腳本可無限並行 |
| 靈活性 | 人類可處理模糊情境 | 腳本只能處理已定義的規則 |
| 失敗模式 | 人類疲勞/疏忽 → 放行壞產出 | 規則不完整 → 漏檢 or 誤殺 |


## 附錄 D: BMAD Context Engineering 技巧分析 (2026-02-15)

> 來源: workflow.xml、quick-spec/workflow.md、step-01-understand.md、adversarial-review.md、quick-flow.md
> 目的: 識別 BMAD 的 context engineering 技巧，評估哪些可借鏡到 SDID

### D.1 七個 Context Engineering 技巧

#### 技巧 1: Step-File Architecture（微檔案架構）

**BMAD 做法**: 每個 step 是獨立的 .md 檔案，只在執行到該步驟時才載入。workflow.md 明確規定：
- "Just-In-Time Loading: Only the current step file is in memory"
- "NEVER load multiple step files simultaneously"
- "NEVER create mental todo lists from future steps"

**原理**: 防止 LLM 的「lost in the middle」問題。Context window 越大，中間段落的注意力越低。只載入當前步驟 = 100% 注意力在當前任務。

**SDID 適用性**: ⚠️ 低。SDID 的 Phase 是 .cjs 腳本，不是 prompt — 腳本不佔 LLM context。但概念可借鏡：Phase 腳本的 @TASK 輸出已經是「只給 AI 當前需要的資訊」，這跟 step-file 的精神一致。SDID 的 @READ 機制（強制 AI 讀 log 而不是在終端印全部）本質上就是 just-in-time loading。

#### 技巧 2: input_file_patterns + Load Strategy（智慧載入策略）

**BMAD 做法**: workflow.yaml 定義每種輸入檔案的載入策略：
- `FULL_LOAD`: 載入整個目錄所有檔案（PRD、Architecture）
- `SELECTIVE_LOAD`: 根據變數只載入特定分片（如 `epic-{{epic_num}}.md`）
- `INDEX_GUIDED`: 先讀 index.md，分析哪些文件跟當前任務相關，只載入相關的

**原理**: Context budget 管理。不是所有文件都跟當前任務相關，但「不載入」的風險是遺漏關鍵資訊。INDEX_GUIDED 是折衷 — 用 index 的摘要判斷相關性，寧可多載不漏載。

**SDID 適用性**: 🟡 中。目前 runner.cjs 啟動時載入 project-memory (@MEMORY) 和 config.json，但沒有「根據當前 Phase 智慧選擇載入什麼」的機制。可能的應用：
- BUILD Phase 2 (標籤驗收) 只需要 functions.json + plan 的 GEMS 標籤段落
- BUILD Phase 5 (測試) 只需要 plan 的 AC 段落 + 測試檔案清單
- 但 SDID 的 Phase 腳本已經自己決定讀什麼檔案，不需要額外的 load strategy 層。這個技巧更適合 prompt-driven workflow，不太適合 script-driven pipeline。

#### 技巧 3: Information Asymmetry（資訊不對稱）

**BMAD 做法**: adversarial review 在獨立 subagent 中執行，只給 diff，不給原始推理過程：
- step-05: "If possible, use information asymmetry: load this step, and only it, in a separate subagent or process with read access to the project, but no context except the {diff_output}"
- adversarial-review.md: "Run reviews with fresh context (no access to original reasoning) so you evaluate the artifact, not the intent"

**原理**: 如果 reviewer 看過原始推理，會產生確認偏誤 — 「他想做 X，程式碼看起來在做 X，所以沒問題」。去掉推理 context，reviewer 只能看程式碼本身 — 「這段程式碼做了什麼？做得對嗎？」

**SDID 適用性**: 🔴 高。這是 P7 (Adversarial Self-Review) 的核心設計原則。具體應用：
- BUILD Phase 8.5 的 review 應該在新的 context 中執行（如果平台支援 subagent）
- 即使不支援 subagent，也可以用「只給 diff + plan AC，不給 BUILD 過程的 log」來模擬資訊不對稱
- 已納入 P7 設計，實作時需注意

#### 技巧 4: Fresh Context Recommendation（乾淨 context 建議）

**BMAD 做法**: quick-flow.md 建議 quick-spec 和 quick-dev 在不同對話中執行：
- "Fresh Context tip: Run quick-dev in a new conversation for clean implementation context"

**原理**: spec 階段的討論、猶豫、替代方案會污染 implementation context。開發 agent 不需要知道「為什麼選 A 不選 B」，只需要知道「做 A」。

**SDID 適用性**: 🟡 中。SDID 的 ralph-loop / blueprint-loop 已經是「每個 Phase 一個 agent 呼叫」的模式 — loop.cjs 每次呼叫 runner.cjs 都是獨立的終端命令，天然就是 fresh context。但可以更明確：
- loop.cjs 在 BUILD 階段切換 Story 時，可以建議「開新對話」
- project-memory 的 @MEMORY 機制已經是 fresh context 的 resume 方案 — 新對話開始時印出最近記錄，不需要讀完整歷史

#### 技巧 5: discover_inputs Protocol（可重用的輸入發現協定）

**BMAD 做法**: workflow.xml 定義了 `discover_inputs` protocol，處理檔案發現的 fallback chain：
1. 先找 sharded 版本（目錄下多個 .md）
2. 找不到就找 whole 版本（單一 .md）
3. 都找不到就標記為 unavailable，不報錯

**原理**: 不同專案的文件結構不同（有的拆分、有的合併），protocol 用 fallback chain 適應各種情況，避免「找不到檔案就爆炸」。

**SDID 適用性**: 🟡 中。SDID 的 Phase 腳本已有類似邏輯（如 phase-1.cjs 找 plan 檔案），但沒有統一的 protocol。可能的應用：
- P6 (棕地逆向工程) 需要掃描既有專案的各種結構 — 有的有 src/modules/，有的是 flat structure
- 統一的 `discoverProjectFiles()` 函式可以減少每個 Phase 腳本重複寫檔案發現邏輯
- 但工程量不大，可以在實作 P6 時順便做

#### 技巧 6: Checkpoint Menu + State Persistence（檢查點選單 + 狀態持久化）

**BMAD 做法**: 每個 step 結束時顯示選單 `[A] Advanced Elicitation / [P] Party Mode / [C] Continue`，狀態存在 WIP 檔案的 frontmatter（`stepsCompleted` 陣列）。下次開啟時自動 resume。

**原理**: 長流程中人類可能中斷。State persistence 讓流程可以從任何 checkpoint resume，不需要從頭開始。

**SDID 適用性**: ✅ 已有。SDID 的 .state.json 就是這個概念的腳本化版本。差異在於 BMAD 的 checkpoint 是「等人類選擇」，SDID 的 checkpoint 是「腳本自動判斷 PASS/FAIL」。SDID 的 resume 機制更精確（知道在哪個 Phase/Step/Story 中斷），BMAD 只知道「完成了哪些 step」。

#### 技巧 7: Escalation Threshold（升級門檻信號計數）

**BMAD 做法**: quick-flow.md 描述 mode detection 用「整體判斷」：
- 升級信號: 多組件提及、系統級語言、不確定性
- 簡單信號: "just"、"fix"、"bug"
- 超過閾值 → 建議走全流程而非 Quick Flow

**原理**: 不是所有任務都需要全流程。但讓人類自己判斷「這個夠不夠複雜」不可靠 — 用信號計數自動建議。

**SDID 適用性**: 🔴 高。這是 P5 (Quick Mode) 的核心設計。具體應用：
- `--quick` flag 的入口可以加一層自動偵測：分析 plan 的 Story 數量、檔案數量、DEPS 複雜度
- 超過閾值 → 印 WARNING 建議走全流程
- 已納入 P5 設計的「可選: 升級門檻偵測」

### D.2 SDID 適用性總結

| 技巧 | 適用性 | 狀態 | 備註 |
|------|--------|------|------|
| Step-File Architecture | ⚠️ 低 | 已有等效 | @TASK + @READ 已是 just-in-time loading |
| Load Strategy | 🟡 中 | 不急 | Script-driven 不太需要，P6 時可順便做 |
| Information Asymmetry | 🔴 高 | P7 核心 | Adversarial Review 的設計原則 |
| Fresh Context | 🟡 中 | 已有等效 | loop.cjs 天然 fresh context，@MEMORY 是 resume 方案 |
| discover_inputs | 🟡 中 | P6 順便 | 統一 discoverProjectFiles() 減少重複 |
| Checkpoint + State | ✅ 已有 | 完成 | .state.json 比 BMAD 的 frontmatter 更精確 |
| Escalation Threshold | 🔴 高 | P5 核心 | Quick Mode 的自動複雜度偵測 |

### D.3 關鍵洞察：Prompt Engineering vs Script Engineering

BMAD 的 context engineering 技巧大多是為了解決「LLM context window 有限」和「LLM 注意力不均勻」的問題。這些問題在 prompt-driven workflow 中很嚴重，但在 script-driven pipeline 中被天然緩解：

| 問題 | BMAD 解法 (Prompt) | SDID 解法 (Script) |
|------|-------------------|-------------------|
| Context 太大 | Step-file + Load Strategy | Phase 腳本自己決定讀什麼 |
| 注意力不均勻 | 微檔案設計，一次一個 step | @TASK 只印當前任務，@READ 指向 log |
| 確認偏誤 | Information Asymmetry (subagent) | Gate 腳本不受 LLM 偏誤影響 |
| 流程中斷 | WIP frontmatter resume | .state.json 精確 resume |
| 複雜度誤判 | Escalation signal counting | (P5 待實作) |

BMAD 用 prompt engineering 解決的問題，SDID 用 script engineering 解決了大部分。但 Information Asymmetry 和 Escalation Threshold 是 BMAD 獨有的洞察，值得借鏡 — 因為這兩個問題即使在 script-driven pipeline 中也存在（AI 執行 review 時仍有確認偏誤，AI 判斷任務複雜度時仍可能誤判）。


## 附錄 E: Loop vs Runner 架構分工 (2026-02-16)

> 來源: P5 Quick Mode 設計討論

### E.1 核心分工

```
loop.cjs = GPS（導航）
  - 讀 .state.json → 知道現在在哪
  - 讀 plan → 知道有幾個 Story
  - 印 @NEXT_COMMAND → 告訴 AI 下一步
  - 印 @RESUME → 中斷後告訴 AI 從哪接
  - 不跑任何驗證邏輯

runner.cjs = 引擎（執行）
  - 載入 phase-X.cjs → 跑掃描/驗證
  - 寫 log、寫 checkpoint
  - 印 @PASS 或 @BLOCKER
  - 寫 .state.json（更新游標）
  - Stateless — 給它 --phase --step --target，跑完就結束
```

### E.2 為什麼這樣分

runner.cjs 是 stateless 的 — 不記得上一次跑了什麼，不關心下一次要跑什麼。
loop.cjs 是 stateful reader — 讀 state 但不改 state（state 是 runner 改的）。

這個分離讓以下場景都能 work：
- 手動跑 runner（你自己當 loop）
- 自動跑 loop + runner（AI 當 loop 的執行者）
- 混用（一個專案手動、另一個自動）
- 中途切換（自動跑到一半，你接手手動跑幾步，再交回自動）

全部靠 `.state.json` 這個共享的真相來源串起來。

### E.3 觸發機制

```
Skill 觸發 (語意關鍵詞):
  「ralph loop」「ralph 小修」→ ralph-loop skill → loop.cjs
  「blueprint」「藍圖」       → blueprint-loop skill → loop.cjs

自動循環:
  loop.cjs 印 @NEXT_COMMAND → AI 執行 runner.cjs → AI 再跑 loop.cjs → 循環

手動:
  你自己跑 runner.cjs --phase=BUILD --step=2 --target=./todo-app
  state 照樣更新，下次 loop.cjs 從你推進到的位置繼續

預設: vibe（沒有關鍵詞 = 沒有 skill = 沒有流程）
```

### E.4 中斷處理

| 場景 | 機制 | 已有/待做 |
|------|------|----------|
| 對話斷了 (context window 爆) | .state.json 記游標 + @MEMORY 印歷史 | ✅ 已有 |
| 對話斷了 → 精確續接 | loop.cjs 印 @RESUME (phase + story + 時間) | ⏳ P5 新增 |
| 中途插入新需求 | steering 規則: 先完成當前 phase 再處理 | ⏳ P5 新增 |
| 手動/自動切換 | .state.json 共享，互不干擾 | ✅ 已有 |


## 附錄 F: BMAD 深度分析第二輪 — 7 個新模式採納決定 (2026-02-16)

> 來源: BMAD-METHOD 第二輪深度分析 (quick-spec, quick-dev, code-review, correct-course, dev-story, QA automate, generate-project-context, validate-agent-schema)

### F.1 分析的 7 個模式

| 代號 | 模式名稱 | 來源 | 採納決定 |
|------|---------|------|---------|
| A | 零容忍門檻 (Adversarial Review) | adversarial-review.md | ✅ 採納，併入 P7 |
| B | Git Reality Check | code-review.md | ❌ 不做 — 沒有 git 自動化基線 |
| C | Plan 路徑驗證 | validate-file-refs.js | ✅ 採納，即 P8 |
| D | Correct-Course 變更處理 | correct-course workflow | 🔒 暫緩 — 低頻場景 |
| E | QA Automate 測試生成 | qa-automate workflow | ❌ 不做 — BUILD Phase 3-5 已覆蓋 |
| F | project-context.json | generate-project-context | ❌ 砍掉 — 假議題 |
| G | Agent Schema Validation | validate-agent-schema | ❌ 不做 — SDID 不是 multi-agent 框架 |

### F.2 各模式分析摘要

#### Pattern A: 零容忍門檻 ✅ 採納

BMAD 的 adversarial review 強制最少找 3 個 findings。核心洞察: AI review 自己的程式碼有確認偏誤，設最低門檻強制認真找問題。併入 Phase 8 而非獨立 Phase — 擴展現有 `qualityIssues[]` 欄位的檢查範圍，加入零容忍門檻 (qualityIssues + suggestions >= 3)。CRITICAL findings 直接 BLOCKER，WARNING/INFO 寫入 suggestions 給下次 iteration。

#### Pattern B: Git Reality Check ❌ 不做

BMAD 的 code-review 用 git diff 作為 review baseline。SDID 目前沒有 git 自動化基線 — 不是每個專案都有 git init，也沒有「每個 Story 開始前自動 commit」的機制。要做 git reality check 得先建 git 自動化基礎設施，工程量不划算。P7 的 review 改用 plan FILE 欄位 vs 實際變更檔案的交叉比對替代。

#### Pattern C: Plan 路徑驗證 ✅ 採納 (= P8)

BMAD 的 validate-file-refs.js 掃描所有檔案引用驗證目標存在。直接對應 P8，加入 plan-validator.cjs 作為新規則。

#### Pattern D: Correct-Course 🔒 暫緩

BMAD 的 6 步變更分析流程。目前沒有「iteration 內需求變更」的實際痛點。Strategy Drift 處理重試，EXPAND 處理新 iteration，中間地帶的需求還沒出現。

#### Pattern E: QA Automate ❌ 不做

BMAD 的 QA 自動化測試生成。SDID 的 BUILD Phase 3 (測試腳本) + Phase 4 (Test Gate) + Phase 5 (TDD 執行) 已完整覆蓋。BMAD 需要獨立的 QA workflow 是因為它的 dev-story 不包含測試，SDID 的 BUILD 天然包含。

#### Pattern F: project-context.json ❌ 砍掉

BMAD 每個 workflow 啟動載入 project-context.md。分析結論: 這是假議題。LLM 透過 IDE 已經會掃全域，SDID 腳本已經在驗證 conventions。BMAD 需要它是因為沒有 runtime 腳本，只能靠 prompt 注入上下文。SDID 有 .cjs 腳本，不需要額外的 context 注入層。降級為 config.json 加三個棕地欄位 (srcDir/testPattern/testCommand)，搭 P8 順手做。

#### Pattern G: Agent Schema Validation ❌ 不做

BMAD 的 validate-agent-schema 驗證 agent persona 定義的完整性。SDID 不是 multi-agent 框架，沒有 agent persona 概念。ralph-loop 和 blueprint-loop 是 skill，不是 agent — 它們的「schema」就是 SKILL.md 的 triggers 和 agent-prompt.md 的規則，已經夠簡單不需要額外驗證。

### F.3 決策原則

這輪分析的核心判斷標準:
1. **有沒有實際痛點？** — 沒有痛點的解決方案是假議題 (Pattern F)
2. **現有機制是否已覆蓋？** — 已覆蓋就不重複建設 (Pattern E, G)
3. **基礎設施是否就緒？** — 基礎設施不在就先不做上層 (Pattern B)
4. **能不能搭便車？** — 能搭就搭，不獨立開工 (Pattern F → config.json 搭 P8)
