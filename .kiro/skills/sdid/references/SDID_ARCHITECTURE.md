# SDID 框架完整架構說明書

**版本**: v7.0
**最後更新**: 2026-03-19
**維護者**: 透過對話補充，有新機制就加進來

---

## 一句話定義
SDID（Structured Iterative Development）是一套「AI 驅動開發協議」。
腳本負責結構性強制（Gate 攔截），AI 負責語意判斷（修復執行），兩者互補不競爭。

```
設計層（design/）→ Contract → Plan → BUILD 實作 → SCAN → VERIFY
         ↑                                                  ↓
         └──────────────── AI 修復循環 ←──── 腳本 Gate 攔截 ──┘
```

---

## 一、框架定位

SDID 核心理念：
- **Gate 驅動**：每個階段有明確的通過條件，不通過就不能進下一步
- **漸進交付**：每個 iter 交付一個可展示、可操作的完整功能切片
- **機械執行**：盡量讓 script 做決策，AI 只做人判斷不了的事

---

## 二、進入判斷與路線

### 2.1 路線選擇指引

**開始任何專案前，先問一個問題：**

> **「UI 版面和操作流程確認了嗎？」**

```
No（版面未確認）→ Task-Pipe 優先
  → POC Step 1-4 快速建 UI 骨架（可點擊、可看版面）
  → 使用者確認版面和流程
  → Step 5 收斂 SPEC → PLAN → BUILD

Yes（版面已確認）→ 看需求複雜度
  → 需求模糊 → Blueprint 路線（5 輪對話）
  → 需求明確 → Task-Pipe 路線
```

### 2.2 全局架構圖（統一管道）

Blueprint 和 Task-Pipe 是**設計輸入方式**的選擇，不是兩條獨立管道。CYNEFIN 之後全部合流進同一套 BUILD。

```
使用者意圖
  ├─ 「小修」「fix」「改一下」
  │     ↓
  │   MICRO-FIX（旁路，不進 BUILD）
  │
  └─ 需求開發（新功能、新專案、繼續開發）
        │
        ├─ 有主藍圖 + [STUB]/[CURRENT]  → BLUEPRINT-CONTINUE
        ├─ UI 未確認 / 需求明確         → Task-Pipe（POC Step 1-5）
        ├─ 需求模糊（UI 已確認）         → Blueprint（5 輪對話）
        └─ 快速建 / 練習專案            → Task-Pipe（sdid-loop）
              ↓ (設計完成，兩路線在此合流)
  ┌─────────────────────────────────────────────────┐
  │              CYNEFIN-CHECK（強制）               │
  └─────────────────────────────────────────────────┘
        ↓ needsTest:true               ↓ needsTest:false
  TDD Contract Subagent           （直接繼續）
  + Design Reviewer
        ↓
  ┌─────────────────────────────────────────────────┐
  │         CONTRACT Gate（contract-gate.cjs v5）    │
  └─────────────────────────────────────────────────┘
        ↓
  spec-to-plan（task-pipe/tools/spec-to-plan.cjs）
        ↓
  ┌─────────────────────────────────────────────────┐
  │           BUILD Phase 1-4 v7（共用）             │
  └─────────────────────────────────────────────────┘
        ↓
  SHRINK → VERIFY（Blueprint）/ SCAN（Task-Pipe）
```

---

## 三、核心架構（v7）

v7 最大變更：引入 TDD 驗收機制，以 `@GEMS-TDD` 替代舊的 `@GEMS-AC-*` 標籤族。

### 四層設計模型

```
Layer 0: Blueprint（可選，全局索引）
  .gems/design/blueprint.md — 模組清單/迭代規劃/依賴關係/API 概覽
    └── blueprint-gate v5

Layer 1: Per-iter Draft（每個 iter 獨立設計）
  .gems/design/draft_iter-N.md — 功能需求 + TDD 測試需求標記
    └── draft-gate v5
    ├── @PASS → CYNEFIN-CHECK
    └── @BLOCKER → 修復 draft 重試

Layer 2: Per-iter Contract（每個 iter 獨立，屬於 iter）
  .gems/iterations/iter-N/contract_iter-N.ts — TypeScript interfaces + STORY-ITEM + @GEMS-TDD
    └── contract-gate v5 + @CONTRACT-LOCK 封版
    └── spec-to-plan.cjs → contract @GEMS-STORIES → implementation_plan（機械轉換）
    └── BUILD Phase 1-4（task-pipe/runner.cjs）
    └── SCAN — 全專案掃描更新 functions.json
    └── blueprint-verify.cjs — 比對 draft vs 實作

Layer 3: POC-FIX（屬於 iter，按需建立）
  iter-N/poc-fix/ — 複雜業務邏輯探索工作區
    └── consolidation-log.md
    └── poc-to-scaffold.cjs 落地
    └── micro-fix-gate.cjs --iter=N 驗收
```

---

## 四、BUILD Phase 1-4（v7）

兩條路線共用，統一透過 MCP `sdid-loop` tool 自動偵測路線和進度。

| Phase | 名稱 | 核心動作 |
|-------|------|---------|
| 1 | 骨架映射層 | 讀 implementation_plan + contract_iter-N.ts，產出骨架 + GEMS 標籤全覆蓋（P0-P3） |
| 2 | TDD 驗收層 | 讀 contract_iter-N.ts 找 @GEMS-TDD：有 → vitest --run（RED→GREEN）；無 → tsc --noEmit |
| 3 | 整合層 | 路由整合、barrel export、模組間整合驗證，Level S 跳過 |
| 4 | 標籤品質+Fillback層 | GEMS 標籤品質複查（P0-P3 全覆蓋），產出 Fillback + iteration_suggestions |

> Level S 走 Phase 1→2→4（跳過 Phase 3）
> Level M/L 走 Phase 1→2→3→4

---

## 五、工具一覽

### sdid-tools/（Blueprint Flow 工具）
| 工具 | 職責 |
|------|------|
| `blueprint/v5/blueprint-gate.cjs` | Blueprint 全局設計文件格式驗證 |
| `blueprint/v5/draft-gate.cjs` | Per-iter Draft 功能需求驗證 |
| `blueprint/v5/contract-gate.cjs` | Per-iter Contract 型別邊界 + @CONTRACT-LOCK 封版 |
| `blueprint/verify.cjs` | 最終驗證 draft vs 實作 |
| `blueprint/shrink.cjs` | 折疊已完成 iter + 升格下一個 STUB |
| `plan-to-scaffold.cjs` | Plan → .ts/.tsx 骨架生成 |
| `poc-to-scaffold.cjs` | consolidation-log → 骨架生成（POC-FIX 落地） |
| `poc-fix/micro-fix-gate.cjs` | 局部驗收，GEMS 標籤 + import 範圍 |
| `cynefin-log-writer.cjs` | 語意域分析記錄 |
| `state-guide.cjs` | AI session 定向，輸出當前狀態 + 下一步指令 |

### task-pipe/（BUILD 執行引擎）
| 工具 | 職責 |
|------|------|
| `runner.cjs` | 主執行入口，依 phase/step/story 驅動各腳本 |
| `phases/build/phase-1~4.cjs` | BUILD 各 Phase 實作腳本 |
| `phases/scan/scan.cjs` | SCAN 全專案掃描 |
| `tools/spec-to-plan.cjs` | contract/spec → implementation_plan（機械轉換） |
| `lib/scan/gems-scanner-unified.cjs` | GEMS 標籤掃描主力 |
| `lib/shared/log-output.cjs` | 統一 log 輸出 |
| `lib/shared/state-manager-v3.cjs` | .state.json 讀寫管理 |
| `lib/shared/project-memory.cjs` | 跨 iter 歷史記憶（pitfall/hint） |

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

## 六、Gate 全覽

| Gate | 位置 | 主要規則 | 工具 |
|------|------|---------|------|
| Blueprint Gate | PLAN 前 | blueprint.md 格式 | `blueprint/v5/blueprint-gate.cjs` |
| Draft Gate | PLAN 前 | Draft 功能需求格式 | `blueprint/v5/draft-gate.cjs` |
| Contract Gate | PLAN 前 | 型別邊界 + @CONTRACT-LOCK | `blueprint/v5/contract-gate.cjs` |
| CYNEFIN Gate | PLAN 前 | Budget 符合語意域 | `cynefin-log-writer.cjs` |
| Phase 2 Gate | BUILD Phase 2 | @GEMS-TDD → vitest GREEN；無 → tsc --noEmit | `task-pipe/runner.cjs` |
| Phase 3 Gate | BUILD Phase 3 | 路由整合、barrel export（Level S 跳過）| sdid-loop 自動執行 |
| Phase 4 Gate | BUILD Phase 4 | GEMS 標籤品質複查 + Fillback 產出 | sdid-loop 自動執行 |
| SHRINK Gate | BUILD 完成後 | 主藍圖折疊 + 升格 | `blueprint/shrink.cjs` |
| VERIFY Gate | SHRINK 後 | 最終交付驗收 | `blueprint/verify.cjs` |
| Micro-Fix Gate | 小修後 | 局部變更不破壞結構 | `poc-fix/micro-fix-gate.cjs` |

---

## 七、狀態推斷機制

`sdid-core/state-machine.cjs` 四層推斷：
```
優先順序:
  1. .state.json（state-manager-v3 ledger）
  2. last_step_result.json
  3. log-based inference（inferStateFromLogs）
  4. draft 存在 → 推斷 GATE
```

路線偵測（`detectRoute`）:

| 條件 | 路線 |
|------|------|
| `.gems/design/` 存在 + `blueprint.md` | Blueprint |
| `.gems/design/` 存在 + `draft_iter-N.md` | Blueprint |
| `iter-N/poc/poc-consolidation-log.md`（v5 legacy） | POC-FIX |
| `iter-N/poc/requirement_spec_*`（v5 legacy） | Task-Pipe |
| `iter-N/poc/requirement_draft_*`（v5 legacy） | Blueprint |

Log 前綴推斷（`inferStateFromLogs`）:

| Log 前綴 | 推斷狀態 |
|---------|---------|
| `gate-verify-pass-` | COMPLETE |
| `build-phase-4-Story-X.Y-pass-` | BUILD 最後一個 Story → VERIFY |
| `gate-plan-pass-` | BUILD Phase 1 |
| `cynefin-check-pass-` | CONTRACT |
| `contract-pass-` / `contract-gate-pass-` | PLAN |
| `draft-gate-pass-` | CONTRACT |
| `blueprint-gate-pass-` | DRAFT |
| `pocfix-active-` | POC-FIX 進行中 |
| `pocfix-pass-` | POC-FIX 完成 |
| `gate-check-error-` | GATE（有錯誤） |

---

## 八、目錄結構（v7）

```
{project}/
├── src/                          # 實際程式碼
└── .gems/
    ├── design/                   # 設計文件集中（v6+）
    │   ├── blueprint.md          # 可選，全局設計索引
    │   └── draft_iter-N.md       # Per-iter Draft（功能需求 + TDD 測試需求）
    ├── logs/                     # MICRO-FIX 全局 log
    │   ├── microfix-pass-{ts}.log
    │   └── microfix-error-{ts}.log
    ├── iterations/
    │   └── iter-N/
    │       ├── .state.json
    │       ├── contract_iter-N.ts    # @GEMS-TDD 路徑在此
    │       ├── poc-fix/              # POC-FIX 工作區（按需建立）
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
    │           ├── build-phase-N-Story-X.Y-{pass|error}-{ts}.log
    │           ├── scan-scan-{pass|error}-{ts}.log
    │           └── gate-verify-{pass|error}-{ts}.log
    ├── docs/
    │   ├── functions.json        # gems-scanner-unified 彙整
    │   └── blueprint-verify.json
    └── project-memory.json       # 跨 iter 歷史記憶
```

> `poc/` 目錄不再建立，v5 legacy 專案保留相容

---

## 九、常用指令參考

```bash
# 主流程（v7）
node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=.gems/design/blueprint.md --target=<project>
node sdid-tools/blueprint/v5/draft-gate.cjs --draft=.gems/design/draft_iter-N.md --target=<project>
node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=<project> --iter=N
node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/iter-N/contract_iter-N.ts --target=<project> --iter=N
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
node sdid-tools/state-guide.cjs --project=<project>
node task-pipe/tools/project-status.cjs --target=<project>

# 監控
node sdid-monitor/server.cjs   # http://localhost:3737
```

---

## 十、GEMS 標籤格式（v7）

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

> v7.0 移除：`// AC-X.Y` 行（AC 機制 deprecated）、`✓✓` 狀態欄（v5.0 已移除）
> TDD 驗收改在 contract 層用 `@GEMS-TDD: src/...test.ts` 標記，Phase 2 機械執行

---

*本說明書依 ARCHITECTURE.md v7.0 同步更新。有新機制、新 Gate、新規則，直接補到對應章節。*
