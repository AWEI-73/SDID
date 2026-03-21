# SDID 系統架構文件
> 版本: v7.0 | 更新: 2026-03-19
> 定位: SDID 全系統的完整架構接線圖，供 AI session 快速定向

---

## 一句話定義
SDID（Structured Iterative Development）是一套「AI 驅動開發協議」。
腳本負責結構性強制（Gate 攔截），AI 負責語意判斷（修復執行），兩者互補不競爭。

```
主流程（唯一路線）:
  Draft → draft-gate → Contract → contract-gate → spec-to-plan → BUILD Phase 1-4 → SCAN → VERIFY
    ↑
  可選前置（需求模糊時才進）:
  Blueprint 5輪對話 → blueprint.md → blueprint-gate → [自動銜接回 Draft 這步]
```

> ⚠️ 重要：Blueprint 不是獨立路線，是主流程的可選入口。
> 需求清楚 → 直接寫 Draft。需求模糊 → 先跑 Blueprint 對話，產出 blueprint.md 後自動銜接 Draft。
> 兩者在 Draft 這步匯流，之後完全共用同一條主流程。
> AI 不應把 sdid-tools/ 和 task-pipe/ 視為兩個平行系統，sdid-tools 是 gate 工具，task-pipe 是 BUILD 執行引擎，都服務同一條主流程。

---

## 核心架構（v7）
v6 最大變更：引入 `design/` 目錄集中管理設計文件，統一多條路線。

```
┌─────────────────────────────────────────────────────────────────┐
│                        v7 核心架構                               │
│                                                                 │
│  .gems/design/blueprint.md（可選）                               │
│    └── blueprint-gate v5                                        │
│  .gems/design/draft_iter-N.md                                   │
│    └── draft-gate v5                                            │
│  .gems/iterations/iter-N/contract_iter-N.ts                     │
│    └── contract-gate v5 + @CONTRACT-LOCK                        │
│  spec-to-plan → BUILD Phase 1-4 → SCAN → VERIFY                │
│                                                                 │
│  POC-FIX: iter-N/poc-fix/（屬於 iter，按需建立）                  │
│  MICRO-FIX: .gems/logs/（不屬於任何 iter）                        │
└─────────────────────────────────────────────────────────────────┘
```

### 四層設計模型
```
Layer 0: Blueprint（可選，全局索引）
  .gems/design/blueprint.md — 模組清單/迭代規劃/依賴關係/API 概覽
    └── blueprint-gate v5（驗 blueprint.md 格式）

Layer 1: Per-iter Draft（每個 iter 獨立設計）
  .gems/design/draft_iter-N.md — 功能需求 + TDD 測試需求
    └── draft-gate v5
    ├── @PASS → 推導 contract
    └── @BLOCKER → 修復 draft 重試

Layer 2: Per-iter Contract（每個 iter 獨立，屬於 iter）
  .gems/iterations/iter-N/contract_iter-N.ts — TypeScript interfaces + STORY-ITEM + @GEMS-TDD
    └── contract-gate v5 + @CONTRACT-LOCK 封版
    └── spec-to-plan.cjs → contract @GEMS-STORIES → implementation_plan（機械轉換）
    └── 產出: iter-N/plan/implementation_plan_Story-X.Y.md
    └── BUILD Phase 1-4（task-pipe/runner.cjs）
        └── 每個 Story 獨立執行
    └── SCAN — 全專案掃描更新 functions.json
    └── blueprint-verify.cjs — 比對 draft vs 實作
       ├── @PASS → 完成（可進下一個 iter）
       └── @WARN → @GEMS-TDD 測試未覆蓋，需補充

Layer 3: POC-FIX（屬於 iter，按需建立）
  iter-N/poc-fix/ — 複雜業務邏輯探索工作區
    └── consolidation-log.md
    └── poc-to-scaffold.cjs 落地
    └── micro-fix-gate.cjs --iter=N 驗收
    └── log: iter-N/logs/pocfix-{active|pass}-{ts}.log
```

### POC-FIX（屬於 iter）
```
iter-N/poc-fix/ 工作區
  ├── 複雜業務邏輯探索
  ├── consolidation-log.md
  ├── poc-to-scaffold.cjs 落地
  ├── micro-fix-gate.cjs --iter=N 驗收
  └── log: iter-N/logs/pocfix-{active|pass}-{ts}.log
```

判斷依據：`iter-N/poc-fix/` 存在 → `iter-N/logs/pocfix-active-*.log`

### MICRO-FIX（不屬於任何 iter）
```
單一函式微調/補標籤/bug fix
  ├── 不走完整 story/plan/設計流程
  ├── micro-fix-gate.cjs --changed=<files> --target=<project>
  ├── @PASS 完成 / @BLOCKER 修復重試
  └── log: .gems/logs/microfix-{pass|error}-{ts}.log（全局 log）
```

---

## 統一 BUILD 實作（Phase 1-4）
所有路線共用 BUILD，由 `task-pipe/runner.cjs` 驅動：
```
task-pipe/runner.cjs --phase=BUILD --step=N --story=Story-X.Y --target=<project>
```

| Phase | 名稱 | 驗收條件 |
|-------|------|---------|
| 1 | 骨架映射層 | 讀 implementation_plan + contract_iter-N.ts，產出骨架 + GEMS 標籤全覆蓋（P0-P3） |
| 2 | TDD 驗收層 | 讀 contract_iter-N.ts 找 @GEMS-TDD 標籤：有 → vitest --run（測試在 contract 階段就寫好，Phase 1 RED，Phase 2 GREEN）；無 → tsc --noEmit（DB/UI 層只驗型別）|
| 3 | 整合層 | 路由整合、barrel export，Level S 跳過 |
| 4 | 標籤品質+Fillback層 | GEMS 標籤品質複查（P0-P3 全覆蓋），產出 Fillback + iteration_suggestions |

> Level S 豁免 Phase 3

---

## 工具清單

### sdid-tools/（Gate 工具 + 設計輔助）
| 工具 | 職責 |
|------|------|
| `blueprint/v5/blueprint-gate.cjs` | Blueprint 全局設計文件格式驗證 |
| `blueprint/v5/draft-gate.cjs` | Per-iter Draft 功能需求 + TDD 測試需求驗證 |
| `blueprint/v5/contract-gate.cjs` | Per-iter Contract v3 型別邊界 + @CONTRACT-LOCK 封版 |
| `blueprint/verify.cjs` | 最終驗證 draft vs 實作一致性 |
| `blueprint/contract-writer.cjs` | Contract 推導撰寫 + 驗證（v4 舊版，v5 改用 contract-gate.cjs）|
| `plan-to-scaffold.cjs` | Plan → .ts/.tsx 骨架生成（type-aware） |
| `poc-to-scaffold.cjs` | consolidation-log → .ts/.tsx 骨架生成（POC-FIX 落地） |
| `poc-fix/micro-fix-gate.cjs` | 局部驗收，GEMS 標籤 + import 範圍，寫 log |
| `cynefin-log-writer.cjs` | 語意域分析記錄；action 層級分析，輸出 actions[].needsTest 決策 |
| `state-guide.cjs` | AI session 定向，輸出當前狀態 + 下一步指令 |

### task-pipe/（BUILD + SCAN 執行引擎）
| 工具 | 職責 |
|------|------|
| `runner.cjs` | 主執行入口，依 phase/step/story 驅動各腳本 |
| `phases/build/phase-1~4.cjs` | BUILD 各 Phase 實作腳本 |
| `phases/scan/scan.cjs` | SCAN 全專案掃描 |
| `tools/spec-to-plan.cjs` | contract/spec → implementation_plan（機械轉換） |
| `lib/scan/gems-scanner-unified.cjs` | GEMS 標籤掃描主力 |
| `lib/shared/log-output.cjs` | 統一 log 輸出（anchorPass/anchorError/emitTaskBlock） |
| `lib/shared/state-manager-v3.cjs` | .state.json 讀寫管理 |
| `lib/shared/project-memory.cjs` | 跨 iter 歷史記憶（pitfall/hint） |
| `tools/shrink-tags.cjs` | GEMS 標籤壓縮工具（可選） |

### sdid-core/（狀態推斷引擎）
| 工具 | 職責 |
|------|------|
| `state-machine.cjs` | 統一狀態推斷（detectRoute/inferStateFromLogs/detectFullState） |
| `architecture-contract.cjs` | 架構約束定義 |

### sdid-tools/mcp-server/（MCP 入口）
| Tool | 職責 |
|------|------|
| `sdid-loop` | 主執行入口，自動推斷狀態並驅動下一步 |
| `sdid-state-guide` | AI session 定向 |
| `sdid-micro-fix-gate` | 局部驗收 |
| `sdid-poc-scaffold` | POC-FIX 骨架生成 |
| `sdid-build` | BUILD/SCAN 執行 |
| `sdid-scanner` | GEMS 標籤掃描 |

---

## Artifact DAG（有向無環圖）

SDID 的 artifact/data flow 是嚴格的 DAG，execution 層的 gate retry 是 self-loop（不影響 DAG 性質）。

### 單 iter Artifact DAG
節點 = artifact，邊 = A 的產出是 B 的輸入
```
                    ┌─────────────────────────────────────────────────────┐
                    │              iter-N  Artifact DAG                   │
                    │                                                     │
  [blueprint.md]───┐                                                     │
  (可選，全局)      │                                                     │
                   ▼                                                     │
  [draft_iter-N.md]──────────────────────────────────────────────────┐  │
  design/          │                                                  │  │
        │          │  ┌──────────────────────────────────────────┐   │  │
        │          │  │  contract_iter-N.ts  (iter-N/)           │   │  │
        │          └─►│  @GEMS-CONTRACT (entities)               │   │  │
        │             │  @GEMS-API                               │   │  │
        │             │  @GEMS-STORY-ITEM (plan 錨點)            │   │  │
        │             │  @GEMS-TDD (測試檔路徑，計算邏輯才加)     │   │  │
        │             └──────────────────────────────────────────┘   │  │
        │                          │                                  │  │
        │             ┌────────────┘                                  │  │
        │             │            │                                  │  │
        │             ▼            ▼                                  │  │
        │  [impl_plan_Story-1.0.md]  [impl_plan_Story-2.0.md]        │  │
        │  [impl_plan_Story-N.0.md]  (銝西方向，Story 各自獨立)       │  │
        │  iter-N/plan/             │                                 │  │
        │             │             │                                 │  │
        │             ▼             ▼                                 │  │
        │  [src/ 骨架]◄─────────────┘  [contract_iter-N.ts] Phase 2  │  │
        │  (Phase 1 產出)               驗收                          │  │
        │             │                │                              │  │
        │             ▼                ▼ TDD GREEN                    │  │
        │  [src/ 完整實作]   [Fillback_Story-X.Y.md]                  │  │
        │  (Phase 2-4)       [iteration_suggestions.json]             │  │
        │             │      iter-N/build/                            │  │
        │             │                                               │  │
        │             ▼                                               │  │
        │  [functions.json]  (SCAN 產出，跨 Story 彙整)               │  │
        │  .gems/docs/                                                │  │
        │             │                                               │  │
        │             ▼                                               │  │
        │  [gate-verify-pass.log]◄────────────────────────────────────┘  │
        │  iter-N/logs/      (VERIFY 比對 draft + functions.json)        │
        │             │                                                   │
        │             ▼                                                   │
        │         [COMPLETE]                                              │
        └─────────────────────────────────────────────────────────────────┘
```

### 跨 iter DAG（多 iter 演進）
VERIFY 完成後，iteration_suggestions 觸發下一個 iter 的 draft 作為起點：
```
iter-1:  draft-1 → contract-1 → plan-1 → BUILD-1 → SCAN-1 → VERIFY-1
                                                                  │
                                              (iteration_suggestions 觸發)
                                                                  │
iter-2:                              draft-2 → contract-2 → plan-2 → BUILD-2 → ...
```

每個 iter 是獨立的 DAG，cycle 不存在。

### Gate Retry（Execution 層 self-loop）
每個 gate 的 retry 是 execution model，不影響 data flow 的 DAG 性質：
```
┌──────────────────────────────────────────────────────────────┐
│  Gate Retry Pattern（每個 gate 節點的執行模型）                │
│                                                              │
│  artifact ──►[gate] ──@PASS──► 下一個 artifact              │
│                  │                                           │
│              @BLOCKER                                        │
│                  │                                           │
│                  ▼                                           │
│            AI 修復 artifact ──►[gate] (retry)               │
│                                                              │
│  retry 上限（strategy drift）:                               │
│    P0: 10 次 | P1: 8 次 | P2: 5 次 | P3: 3 次              │
│  超過上限 → STRATEGY_SHIFT → PLAN_ROLLBACK                   │
└──────────────────────────────────────────────────────────────┘
```

### DAG 節點表

| Artifact | 產出者 | 消費者 | Terminal? |
|----------|--------|--------|-----------|
| `design/blueprint.md` | AI（5 輪對話） | blueprint-gate, draft-gate | 否 |
| `design/draft_iter-N.md` | AI（對話/迭代） | draft-gate, VERIFY | 否 |
| `iter-N/contract_iter-N.ts` | AI（從 draft 推導） | contract-gate, spec-to-plan, Phase 2 | 否 |
| `iter-N/plan/impl_plan_Story-X.Y.md` | spec-to-plan | BUILD Phase 1 | 否 |
| `src/` 骨架 | BUILD Phase 1 | BUILD Phase 2-4 | 否 |
| `iter-N/build/Fillback_Story-X.Y.md` | BUILD Phase 4 | VERIFY（參考） | 否 |
| `.gems/docs/functions.json` | SCAN | VERIFY, sdid-loop HUB | 否 |
| `iter-N/logs/gate-verify-pass-*.log` | VERIFY | state-machine（COMPLETE 判斷） | **是** |
| `.gems/logs/microfix-pass-*.log` | micro-fix-gate | state-machine | **是（MICRO-FIX）** |
| `iter-N/logs/pocfix-pass-*.log` | micro-fix-gate --iter | state-machine | **是（POC-FIX）** |

---

## 狀態推斷機制
`sdid-core/state-machine.cjs` 四層推斷：
```
優先順序:
  1. .state.json（state-manager-v3 ledger）
  2. last_step_result.json
  3. log-based inference（inferStateFromLogs）
  4. draft 存在 → 推斷 GATE
```

路線偵測（`detectRoute`）:

> ⚠️ detectRoute 只用來判斷「目前在主流程的哪個 phase」，不代表有兩條獨立路線。
> Blueprint 是可選前置，走完後自動銜接主流程的 Draft 步驟。

| 條件 | 推斷 phase |
|------|------|
| `.gems/design/blueprint.md` 存在但無 draft | Blueprint 前置進行中 → 引導完成後建 draft |
| `.gems/design/draft_iter-N.md` 存在 | GATE（draft-gate） |
| `iter-N/contract_iter-N.ts` 存在 | CONTRACT 或之後 |
| `iter-N/poc/poc-consolidation-log.md`（v5 legacy） | POC-FIX |
| `iter-N/poc/requirement_spec_*`（v5 legacy） | 視同 draft，進 GATE |
| `iter-N/poc/requirement_draft_*`（v5 legacy） | 視同 draft，進 GATE |

Log 前綴推斷（`inferStateFromLogs`）:

| Log 前綴 | 推斷狀態 |
|---------|---------|
| `gate-verify-pass-` | COMPLETE |
| `build-phase-4-Story-X.Y-pass-` | BUILD 最後一個 Story → VERIFY |
| `gate-plan-pass-` | BUILD Phase 1 |
| `gate-check-pass-` | CYNEFIN_CHECK 或 CONTRACT 或 PLAN |
| `cynefin-check-pass-` | CONTRACT |
| `contract-pass-` / `contract-gate-pass-` | PLAN |
| `draft-gate-pass-` | CONTRACT |
| `blueprint-gate-pass-` | DRAFT |
| `pocfix-active-` | POC-FIX 進行中 |
| `pocfix-pass-` | POC-FIX 完成（進下一步） |
| `gate-check-error-` | GATE（有錯誤） |

---

## TDD 追蹤鏈（v7.0）
```
draft_iter-N.md
  Story-X.Y: 功能需求描述
    │
    ├── draft-gate + cynefin-check（分析計算複雜度）
    │
    contract_iter-N.ts
    │  TDD Contract Subagent：needsTest:true action
    │  → 寫測試檔（RED）
    │  → 加 @GEMS-TDD: src/modules/.../xxx.test.ts
    │
    ├── spec-to-plan → implementation_plan
    │
    ├── BUILD Phase 1（骨架建立）
    │   測試檔已存在，import 失敗 → RED 狀態
    │
    ├── BUILD Phase 2（TDD 驗收層）
    │   有 @GEMS-TDD → vitest --run（修實作讓測試 GREEN，不能動測試檔）
    │   無 @GEMS-TDD → tsc --noEmit（DB/UI 層只驗型別）
    │
    └── BUILD Phase 4 / SCAN
        GEMS 標籤品質複查 + Fillback
```

---

## 目錄結構（v6）
```
{project}/
├── src/                          # 實際程式碼
└── .gems/
    ├── design/                   # 設計文件集中（v6 新增）
    │   ├── blueprint.md          # 可選，全局設計索引
    │   ├── draft_iter-1.md       # Per-iter Draft（功能需求 + TDD 測試需求）
    │   ├── draft_iter-2.md
    │   └── poc_iter-N.html       # 可選，UI 原型
    ├── logs/                     # MICRO-FIX 全局 log（不屬於任何 iter）
    │   ├── microfix-pass-{ts}.log
    │   └── microfix-error-{ts}.log
    ├── iterations/
    │   └── iter-N/
    │       ├── .state.json       # 執行狀態（state-manager-v3）
    │       ├── contract_iter-N.ts  # Contract（iter 核心 artifact）
    │       ├── poc-fix/          # POC-FIX 工作區（按需建立）
    │       │   └── consolidation-log.md
    │       ├── plan/
    │       │   └── implementation_plan_Story-X.Y.md
    │       ├── build/
    │       │   ├── Fillback_Story-X.Y.md
    │       │   └── iteration_suggestions_Story-X.Y.json
    │       └── logs/
    │           ├── blueprint-gate-{pass|error}-{ts}.log
    │           ├── draft-gate-{pass|error}-{ts}.log
    │           ├── contract-gate-{pass|error}-{ts}.log
    │           ├── cynefin-check-{pass|fail}-{ts}.log
    │           ├── cynefin-report-{ts}.json  # action-level needsTest 供 TDD Contract Subagent 讀取
    │           ├── pocfix-active-{ts}.log
    │           ├── pocfix-pass-{ts}.log
    │           ├── build-phase-N-Story-X.Y-{pass|error}-{ts}.log
    │           ├── scan-scan-{pass|error}-{ts}.log
    │           └── gate-verify-{pass|error}-{ts}.log
    ├── docs/
    │   ├── functions.json        # gems-scanner-unified 彙整
    │   └── blueprint-verify.json
    └── project-memory.json       # 跨 iter 歷史記憶（pitfall/hint）
```

> `poc/` 目錄不再建立，v5 legacy 專案保留相容

---

## MCP Loop 狀態機流程

`sdid-loop` MCP tool 自動驅動，每次呼叫：

1. 偵測當前 iter
2. `detectRoute()` 判斷路線
3. `inferStateFromLogs()` 推斷當前 phase
4. 執行對應工具
5. 輸出 log + @TASK / @PASS / @BLOCKER 指令

```
sdid-loop(project=<path>)
  ├── phase=NO_DRAFT  → 引導使用者建立 design/draft_iter-N.md
  ├── phase=GATE
  │     ├── contract_iter-N.ts 存在 → contract-gate v5
  │     ├── design/draft_iter-N.md 存在 → draft-gate v5
  │     └── design/blueprint.md 存在 → blueprint-gate v5
  ├── phase=CONTRACT  → 輸出 @TASK 讓 AI 推導 contract（存到 iter-N/）
  ├── phase=PLAN      → spec-to-plan.cjs
  ├── phase=BUILD     → runner.cjs --phase=BUILD --step=N
  ├── phase=SCAN      → runner.cjs --phase=SCAN
  ├── phase=VERIFY    → blueprint-verify.cjs（讀 design/draft_iter-N.md）
  ├── phase=POC-FIX   → micro-fix-gate.cjs --iter=N
  └── phase=MICRO-FIX → micro-fix-gate.cjs（不帶 --iter）
```

---

## 常用指令參考
```bash
# 主流程（v6）
node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=.gems/design/blueprint.md --target=<project>
node sdid-tools/blueprint/v5/draft-gate.cjs --draft=.gems/design/draft_iter-N.md --target=<project>
node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/iter-N/contract_iter-N.ts --target=<project> --iter=N
node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=<project> --iter=N
node task-pipe/tools/spec-to-plan.cjs --target=<project> --iteration=iter-N
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=SCAN --target=<project>
node sdid-tools/blueprint/verify.cjs --draft=.gems/design/draft_iter-N.md --target=<project> --iter=N

# POC-FIX
node sdid-tools/poc-to-scaffold.cjs --log=<consolidation-log.md> --target=<project>
node sdid-tools/poc-fix/micro-fix-gate.cjs --target=<project> --iter=N

# MICRO-FIX
node sdid-tools/poc-fix/micro-fix-gate.cjs --changed=<files> --target=<project>

# 輔助工具
node task-pipe/tools/shrink-tags.cjs --target=<project> --dry-run
node sdid-tools/state-guide.cjs --project=<project>
node task-pipe/tools/project-status.cjs --target=<project>

# 監控
node sdid-monitor/server.cjs   # http://localhost:3737
```

---

## Skill 路由（AI 入口）

`.agent/skills/sdid/SKILL.md` 是 AI 的路由 hub：
| 觸發詞 | 路線 | 行動 |
|--------|------|------|
| 「修一下」「單一函式」 | MICRO-FIX | 直接跑 micro-fix-gate（不帶 --iter） |
| 「POC 探索」「複雜業務」「第三方串接」 | POC-FIX | iter-N/poc-fix/ 工作區 |
| 「有 draft」「有 contract」 | GATE | sdid-loop 自動推斷 |
| 「有 contract」「有 plan」 | CONTRACT/PLAN | sdid-loop 自動推斷 |
| 「有 implementation_plan」 | BUILD | sdid-loop 自動推斷 |
| 「全新專案」「沒有任何文件」 | NO_DRAFT | 引導建立 design/draft_iter-1.md |

---

## GEMS 標籤格式

```typescript
/**
 * GEMS: functionName | P[0-3] | (args)→Result | Story-X.X | 描述
 * GEMS-FLOW: Step1→Step2→Step3
 * GEMS-DEPS: [Type.Name (說明)]
 * GEMS-DEPS-RISK: LOW | MEDIUM | HIGH
 */
// [STEP] Step1              // P0/P1 強制，P2/P3 可選
// [STEP] Step2
export function functionName(...) { ... }
```

> `// AC-X.Y` 已 deprecated（v7.0），由 contract.ts 的 `@GEMS-TDD` 取代。

Shrink 後格式（shrink-tags.cjs 壓縮）：
```typescript
// GEMS: functionName | P1 | FLOW: Step1→Step2
// [STEP] Step1
export function functionName(...) { ... }
```
