# SDID 全局總覽 — Master Plan v3.0

> 版本: v3.0 | 日期: 2026-02-22
> 用途: 整個 SDID 系統的架構總覽，供開發者和 AI 理解全貌
> 語言: 繁體中文

---

## 0. 一句話定義

SDID (Script-Driven Iterative Development) 是一套「AI 驗收協議」— 用腳本驅動的 Gate 機制，把 AI 的隨機輸出約束成可預測的結構化產出。

核心哲學: **腳本決定，AI 執行。Gate 比記憶重要。**

---

## 1. SDID 解決什麼問題

| 問題 | 傳統 AI coding | SDID 做法 |
|------|---------------|----------|
| AI 亂寫一通 | 人工 review | Gate 腳本自動驗收，不過就重來 |
| 需求模糊 | AI 自己猜 | POC 階段強制模糊消除 |
| 隱含複雜度被忽略 | 做到一半才發現 | Cynefin Check 在進 PLAN 前強制展開 |
| 做到一半忘了 | 重新開對話 | State Ledger + project-memory 自動記錄 |
| 標籤/規格不一致 | 沒人管 | GEMS 標籤協議 + BUILD Phase 2 掃描 |
| 複雜專案結構混亂 | vibe coding 碰運氣 | 迭代規劃 + 模組化 Story 拆分 |

---

## 2. 系統架構

### 2.1 整體結構

```
使用者
  │
  ▼
.agent/skills/sdid/          ← 統一入口 (SKILL.md + Hub 路由)
  │
  ├─ 路線 A: Blueprint ──────────────────────────────────────┐
  │   5 輪對話 → Enhanced Draft → Gate → draft-to-plan       │
  │                                                          │
  ├─ 路線 B: Task-Pipe ──────────────────────────────────────┤
  │   POC Step 1-5 → PLAN Step 1-5                          │
  │                                                          │
  │   ↓ 兩條路線在此匯流                                      │
  │                                                          │
  └──────────────► implementation_plan ◄────────────────────┘
                        │
                        ▼
              [CYNEFIN-CHECK] ← 進 PLAN 前強制執行
                        │
                        ▼
              BUILD Phase 1-8 (共用)
                        │
                        ▼
              SCAN / SHRINK / VERIFY
```

### 2.2 雙引擎工具鏈

**task-pipe** — 規格導向引擎。走 POC (5 步) → PLAN (5 步) → BUILD (8 步) → SCAN。

**sdid-tools** — Vibe 導向引擎。走 Gate → draft-to-plan → BUILD → Shrink → Expand → Verify。

兩條路線的目的地一樣：產出 `implementation_plan` → 進入 BUILD Phase 1-8。BUILD 不需要知道你從哪條路來的。

### 2.3 目錄結構

```
workspace/
├── .agent/skills/sdid/              ← 統一 AI Skill 入口
│   ├── SKILL.md                     ← Hub 路由 + Mode Lock
│   ├── references/
│   │   ├── blueprint-design.md      ← 路線 A 的 5 輪對話規則
│   │   ├── taskpipe-design.md       ← 路線 B 的 POC-PLAN 規則
│   │   ├── cynefin-check.md         ← 進 PLAN 前語意域分析
│   │   ├── architecture-rules.md    ← 模組化架構規則
│   │   └── action-type-mapping.md   ← 動作類型映射
│   └── scripts/
│       ├── taskpipe-loop.cjs        ← Task-Pipe loop proxy
│       └── blueprint-loop.cjs       ← Blueprint loop proxy
│
├── task-pipe/                       ← 規格導向引擎
│   ├── runner.cjs                   ← 主入口 (phase/step 路由)
│   ├── phases/
│   │   ├── poc/step-1~5.cjs        ← POC 階段
│   │   ├── plan/step-1~5.cjs       ← PLAN 階段
│   │   ├── build/phase-1~8.cjs     ← BUILD 階段
│   │   └── scan/scan.cjs           ← SCAN 階段
│   ├── skills/sdid-loop/scripts/
│   │   └── loop.cjs                ← Task-Pipe loop 實體
│   └── lib/shared/
│       ├── log-output.cjs          ← 輸出協議 v3.0 + emit* 函式
│       ├── project-memory.cjs      ← 記憶系統
│       └── state-manager-v3.cjs    ← State Ledger
│
├── sdid-tools/                      ← Vibe 導向引擎
│   ├── blueprint-gate.cjs          ← 藍圖品質門控
│   ├── draft-to-plan.cjs           ← 藍圖→執行計畫 (零 AI 推導)
│   ├── blueprint-shrink.cjs        ← 迭代完成後收縮藍圖
│   ├── blueprint-expand.cjs        ← 進入新迭代時展開 Stub
│   ├── blueprint-verify.cjs        ← 藍圖↔源碼雙向語意比對
│   └── cynefin-log-writer.cjs      ← Cynefin Check 結果寫 log
│
├── .agent/skills/blueprint-loop/
│   └── scripts/loop.cjs            ← Blueprint loop 實體
│
└── {project}/                       ← 目標專案
    └── .gems/
        ├── iterations/iter-X/
        │   ├── poc/                 ← requirement_draft, spec, POC.html
        │   ├── plan/                ← implementation_plan_Story-X.Y.md
        │   ├── build/               ← Fillback, iteration_suggestions
        │   └── logs/                ← 所有 gate/phase 執行日誌
        ├── project-memory.json      ← 記憶系統資料
        └── docs/functions.json      ← GEMS 函式索引
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
// [STEP] Validate
// [STEP] Create
// [STEP] Store
// [STEP] Return
```

P0/P1 函式必須有 `[STEP]` 錨點與 `GEMS-FLOW` 對應。

### 3.2 輸出協議 v3.0

終端只印信號，細節存 log，AI 透過 `@READ` 強制讀取：

```
@PASS / @FIX / @FILL / @BLOCK    ← 結果信號
TARGET: src/xxx.ts                ← 目標檔案
@HINT: 前一個 Story 曾在此失敗    ← 歷史提示
@READ: .gems/.../xxx.log          ← 強制 AI 讀 log
NEXT: node task-pipe/...          ← 下一步指令
@GUARD: 禁止修改 src/shared/types ← 施工紅線
```

4 個統一 emit 函式（雙引擎同步）：
- `emitPass` — 成功 + 進度 + 下一步
- `emitFix` — 可修復錯誤 + 目標 + 缺失項 + 範例
- `emitFill` — 需要填空的模板
- `emitBlock` — 結構性阻擋，無法局部修復

### 3.3 三層資料模型

```
┌─────────────────────────────────────────────────────────┐
│  STATE (狀態機) — 單一真相來源                            │
│  位置: .gems/iterations/iter-X/.state.json              │
│  職責: 現在在哪、重試幾次了、策略漂移到哪層               │
│  讀寫: runner.cjs 啟動時讀、step 結束時寫                 │
├─────────────────────────────────────────────────────────┤
│  LOG (任務接收機)                                        │
│  位置: .gems/iterations/iter-X/logs/*.log               │
│  職責: 這次具體錯什麼、怎麼修                             │
│  讀寫: 腳本寫、AI 透過 @READ 讀                          │
├─────────────────────────────────────────────────────────┤
│  MEMORY (記憶彙總)                                       │
│  位置: .gems/project-memory.json                        │
│  職責: 歷史上哪裡容易出問題                               │
│  讀寫: 腳本 append、runner 啟動時讀 (@MEMORY/@PITFALL)    │
└─────────────────────────────────────────────────────────┘

STATE 是游標，LOG 是細節，MEMORY 是趨勢。
```

### 3.4 Cynefin Check（進 PLAN 前強制執行）

兩條路線在進入 PLAN 前都必須執行 Cynefin Check，核心目的是**展開隱含複雜度**：

```
Blueprint:  Enhanced Draft 完成 → [CYNEFIN-CHECK] → @PASS → draft-to-plan → BUILD
Task-Pipe:  POC Step 5 完成    → [CYNEFIN-CHECK] → @PASS → PLAN Step 1 → BUILD
```

AI 對每個模組做三問域識別（Clear / Complicated / Complex），並主動展開隱含步驟。
結果寫成 report JSON → 呼叫 `cynefin-log-writer.cjs` 客觀判定 → `@PASS` 或 `@NEEDS-FIX`。

沒過就 AI 直接修文件，不重跑整個流程，直到腳本說 `@PASS`。

### 3.5 策略漂移 (Strategy Drift)

重試不是單純重複，而是維度的提升：

| Level | 重試次數 | 策略 | 行動 |
|-------|---------|------|------|
| 1 | 1-3 次 | TACTICAL_FIX | 局部修補，在原檔案修復 |
| 2 | 4-6 次 | STRATEGY_SHIFT | 換方式實作，考慮重構 |
| 3 | 7+ 次 | PLAN_ROLLBACK | 質疑架構，回退 PLAN 階段 |

### 3.6 記憶系統 (project-memory)

設計原則：File-first, JSON-structured, Script-driven。

```
recordEntry()       — 每次 Phase/Step 執行完自動記錄 verdict + summary
getResumeContext()  — 新對話開始時印出最近 5 筆 + pitfall
getHistoricalHint() — 查詢同 phase/step 歷史錯誤，產出 @HINT
```

---

## 4. 兩條流程詳解

### 4.1 Task-Pipe Flow（規格導向）

```
POC (5 步)
  Step 1: 模糊消除 — 讀 requirement_draft，消除歧義
  Step 2: 規模評估 — 評估 S/M/L，檢查 Story 數量
  Step 3: 契約設計 — 產出 @GEMS-CONTRACT 型別定義
  Step 4: UI 原型  — 產出 POC.html + @GEMS-DESIGN-BRIEF
  Step 5: 需求規格 — 產出 requirement_spec
    ↓
[CYNEFIN-CHECK]
    ↓
PLAN (5 步)
  Step 1: 需求確認 — 確認需求，模糊消除
  Step 2: 規格注入 — 生成 implementation_plan_Story-X.Y.md
  Step 3: 架構審查 — Constitution Audit
  Step 4: 標籤設計 — 設計 GEMS 標籤規格
  Step 5: 最終確認 — plan-validator 驗證格式
    ↓
BUILD (8 步) → SCAN
```

### 4.2 Blueprint Flow（Vibe 導向）

```
Gemini Gem 5 輪對話 → Enhanced Draft
    ↓
blueprint-gate.cjs → 驗證藍圖品質
    ↓
[CYNEFIN-CHECK]
    ↓
draft-to-plan.cjs → 機械轉換為 implementation_plan（零 AI 推導）
    ↓
BUILD Phase 1-8（與 Task-Pipe 共用）
    ↓
blueprint-shrink.cjs → 收縮已完成的迭代
    ↓ (如果有下一個 iter)
blueprint-expand.cjs → 展開 Stub → 進入下一個 iter
    ↓ (最後)
blueprint-verify.cjs → 藍圖↔源碼雙向語意比對
```

活藍圖哲學：藍圖是 single source of truth，隨開發進度自動收縮。已完成的迭代削減為摘要，未完成的逐步展開。

### 4.3 BUILD Phase 1-8（共用）

```
Phase 1: 骨架檢查    — 確保環境和檔案結構存在，plan-validator 驗證格式
Phase 2: 標籤驗收    — 掃描 src 確保每個函式符合 GEMS 標籤（The Enforcer）
Phase 3: 測試腳本    — 寫測試檔案
Phase 4: Test Gate   — 驗證測試檔案存在且 import 被測函式
Phase 5: TDD 執行    — Unit/Integration 測試
Phase 6: 整合測試    — 修改檔案後的整合測試
Phase 7: 整合檢查    — 路由、模組匯出等整合項目
Phase 8: Fillback    — 對抗式自我審查 + 產出 iteration_suggestions
```

Phase 8 包含對抗式檢查（假實作偵測、AC 覆蓋、plan 外檔案），`qualityIssues + suggestions >= 3` 才能過。

### 4.4 Quick Mode（小步快跑）

觸發詞：「小修」「fix」「quick fix」「改一下」

```
iter-quick-NNN（不佔正式 iter 序號）
  → AI 產精簡版 implementation_plan（一個 Story）
  → PLAN-5 (plan-validator)
  → BUILD Phase 1, 2, 5, 7（跳過 3, 4, 6, 8）
  → 完成，不進下一個 iteration
```

---

## 5. SDID Skill 路由邏輯

統一入口 `.agent/skills/sdid/SKILL.md`，AI 進入後的判斷順序：

| 條件 | 模式 | 動作 |
|------|------|------|
| 說「小修」「fix」「改一下」 | MICRO-FIX | escalation check → 直接改 → micro-fix-gate |
| 無專案 + 需求模糊 | DESIGN-BLUEPRINT | 5 輪對話 |
| 無專案 + 需求明確 | DESIGN-TASKPIPE | taskpipe-loop.cjs --new |
| 有 draft，無 plan | BUILD-AUTO | 看 draft 類型自動選路線 |
| 有 implementation_plan | BUILD-AUTO | 自動偵測路線繼續 BUILD |
| 意圖不明 | 問一個問題 | 「大方向設計還是直接開始？」 |

### Draft 類型自動判斷

```
draft 有 Enhanced Draft 格式標記（模組動作表、迭代規劃表）
  → Blueprint 路線 → CYNEFIN-CHECK → blueprint-loop.cjs

draft 是簡單 requirement_draft
  → Task-Pipe 路線 → CYNEFIN-CHECK → taskpipe-loop.cjs
```

---

## 6. Loop 腳本架構

```
loop.cjs = 導航（讀 state，告訴 AI 下一步是什麼）
runner.cjs = 引擎（實際跑 phase 腳本，產出 @PASS/@BLOCKER）
```

loop 不跑驗證邏輯，只印 `@NEXT_COMMAND`。runner 是 stateless 的。
兩者共享 `.state.json` 這個真相來源。

### State Ledger 優先原則

`.state.json` 是 primary source，O(1) 讀取。
Filesystem（log 時間戳爬梳）是 fallback recovery，只在 state.json 損壞時觸發。

### @RESUME — 中斷續接

loop.cjs 啟動時偵測未完成的 phase：

```
@RESUME: BUILD Phase 3, Story-1.0 (中斷於 2026-02-22T10:30)
@NEXT_COMMAND: node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0 --target=./todo-app
```

---

## 7. Log 命名規則

| 工具 | log 前綴 | 範例 |
|------|---------|------|
| blueprint-gate | `gate-check-` | `gate-check-pass-2026-02-22T10-30-00.log` |
| draft-to-plan | `gate-plan-` | `gate-plan-pass-2026-02-22T10-30-01.log` |
| blueprint-shrink | `gate-shrink-` | `gate-shrink-pass-2026-02-22T10-30-02.log` |
| blueprint-expand | `gate-expand-` | `gate-expand-pass-2026-02-22T10-30-03.log` |
| blueprint-verify | `gate-verify-` | `gate-verify-pass-2026-02-22T10-30-04.log` |
| BUILD Phase 1-8 | `build-phase-` | `build-phase-2-Story-1.0-error-2026-02-22T10-30-05.log` |
| Cynefin Check | `cynefin-check-` | `cynefin-check-pass-2026-02-22T10-30-06.log` |
| Cynefin Report | `cynefin-report-` | `cynefin-report-2026-02-22T10-30-06.json` |

所有 log 存放：`.gems/iterations/iter-X/logs/`

---

## 8. 核心原則

1. **腳本決定，AI 執行** — AI 不需要「理解全貌」才能修復。腳本告訴它 TARGET + MISSING + EXAMPLE，照做就好。
2. **資訊落差驅動行為** — 終端不印修復細節 → AI 必須讀 log → 修復品質提升。
3. **結構化記憶 > 語義記憶** — 「BUILD Phase 2, Story-1.0, MISSING: GEMS-FLOW」比「上次好像標籤有問題」有用 100 倍。
4. **Gate 比記憶重要** — 記憶解決「記得住」，Gate 解決「做得對」。
5. **預防優於追蹤** — Gate 是「防止錯誤傳播」的預防機制。如果有 WARNING 穿透 Gate，正確做法是升級為 BLOCKER，不是建因果圖。
6. **展開隱含複雜度** — 需求寫得很簡單不代表背後沒有複雜度。Cynefin Check 的核心價值是主動展開，不是等問題爆發。

---

## 9. 刻意不做的事

| 提案 | 為什麼不做 |
|------|-----------|
| Vector search / Embedding | SDID 的記憶是結構化的，精確查詢就夠用 |
| AI 自己決定記什麼 | 腳本已經知道該記什麼，不需要 LLM 判斷 |
| Decision Graph / 因果圖 | Gate 已防止因果鏈形成，追蹤是多餘的 |
| 獨立 CLI agent (`sdid run --auto`) | 工程量太大，跟現有 AI tools 重疊 |
| 跨專案記憶 | LLM 訓練資料 + steering file 已覆蓋 |
| Log JSON 化 | 增加複雜度，text log + @READ 已夠用 |
| Proof of Read (hash 驗證) | AI 可能學會只 grep hash 不讀內容，ROI 不划算 |
| Auto-Advance / Daemon 模式 | AI 的 read 行為不完全可控，省的 token 會被迷路吃回去 |

---

## 10. 產品形態願景

```
Layer 1: MCP Server (核心，已有 GEMS Orchestrator MCP 雛形)
  → 把 task-pipe + sdid-tools 包成 MCP tools
  → 任何支援 MCP 的 AI tool 都能呼叫

Layer 2: CLI Extension (進階)
  → sdid init / sdid run / sdid status
  → npm install -g 就能用

Layer 3: IDE UI (遠期)
  → 視覺化 Blueprint 模組依賴圖
  → 迭代規劃、BUILD 進度、Gate 狀態
```

---

## 11. 跟其他工具的定位差異

| 工具 | 做什麼 | SDID 的角色 |
|------|--------|------------|
| Cursor / Kiro / OpenCode | 生成程式碼 | SDID 定義驗收標準，AI tool 負責執行 |
| BMAD-METHOD | 人類引導型 workflow | SDID 是腳本驗證型，Gate 是 process.exit 不是 checklist |
| Devin / SWE-Agent | 自主 coding agent | SDID 可以是它們的 workflow layer |
| GitHub Copilot | 行內補全 | 無交集 |

核心差異：AI coding tools 解決「怎麼寫」，SDID 解決「寫什麼、怎麼驗、寫完了沒」。

---

*SDID Master Plan v3.0 | 2026-02-22 | 基於 v2.1 + SDID_EVOLUTION_DISCUSSION + Cynefin Check 整合*
