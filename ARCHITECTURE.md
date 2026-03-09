# SDID 系統架構書

> 版本: v5.0 | 更新: 2026-03-04
> 定位: SDID 框架完整架構說明，供人類閱讀與 AI session 導航

---

## 一、核心概念

SDID（Structured Iterative Development）是一套 **AI 協同開發框架**。

核心主張：用腳本驅動的 Gate 機制，把 AI 的隨機輸出約束成可預測的結構化產出。
每個 Phase 都有明確的輸入、輸出、驗收條件，AI 不需要記憶規格，只需讀腳本輸出執行。

```
需求 → 路線選擇 → 設計/驗證 → Plan → BUILD 八關 → 驗收
         │                                              │
         └──── AI 讀腳本輸出 ──── 修復 ──── 重跑 ───────┘
```

---

## 二、四條路線

```
┌─────────────────────────────────────────────────────────────────────┐
│                        路線路由                                      │
│                                                                     │
│  需求模糊 / 大型功能          → Blueprint Flow                       │
│  特化模組 / 第三方串接        → POC-FIX                              │
│  單函式微調 / 快速修復        → MICRO-FIX                            │
│  漸進式設計 / 小型專案        → Task-Pipe Flow (備用)                │
└─────────────────────────────────────────────────────────────────────┘
```

### 路線 A：Blueprint Flow（主線）

```
Enhanced Draft (人寫)
  │
  ▼ blueprint-gate.cjs        ← 15 項機械驗收（AC/VSC/層次/預算）
  │  @PASS → 繼續
  │  @BLOCKER → 修 draft 重跑
  │
  ▼ draft-to-plan.cjs         ← 拆成 Story + implementation_plan
  │  產出: plan/implementation_plan_Story-X.Y.md
  │        骨架 .ts/.tsx（plan-to-scaffold.cjs）
  │
  ▼ BUILD Phase 1-8           ← 共用 task-pipe/runner.cjs
  │  每個 Story 跑一輪
  │
  ▼ blueprint-shrink.cjs      ← 壓縮 draft → 錨點格式
  │
  ▼ blueprint-verify.cjs      ← 逐行核對 draft vs 源碼
  │  @PASS → 進下一個 iter 或完成
  │  @WARN → AC 未標記（補標後重跑）
  │
  ▼ blueprint-expand.cjs      ← 展開下一個 iter（如有）
```

識別標記：`.gems/iterations/iter-N/poc/requirement_draft_iter-N.md`

### 路線 B：POC-FIX

```
Phase 1: SETUP        ← 建 poc/ 工作目錄，放原型檔案
Phase 2: VERIFY       ← 反覆驗證調整（可多輪）
Phase 3: CONSOLIDATE  ← 整合清除，產出 poc-consolidation-log.md
Phase 4: BUILD+TEST   ← poc-to-scaffold.cjs 產骨架
                         → 填入 POC 邏輯
                         → micro-fix-gate.cjs --iter=N 驗收
```

識別標記：`.gems/iterations/iter-N/poc/poc-consolidation-log.md`

適用：第三方 API 串接、客製化演算法、複雜資料處理等特化功能（非標準 CRUD）

### 路線 C：MICRO-FIX

```
確認要改什麼（一句話）
  → 直接修改檔案
  → micro-fix-gate.cjs --changed=<files> --target=<project> --iter=N
  → @PASS 完成 / @BLOCKER 修復重跑
```

適用：單一檔案/函式的小修，不需要 story/plan/測試

### 路線 D：Task-Pipe Flow（備用）

```
POC Step 1-5 → PLAN Step 1-5 → BUILD Phase 1-8 → SCAN
```

適用：漸進式設計、小型專案、需要 POC 先驗證 UI 的場景

---

## 三、共用 BUILD 八關（Phase 1-8）

所有路線（Blueprint/Task-Pipe）共用同一套 BUILD，透過 `task-pipe/runner.cjs` 執行。

```
task-pipe/runner.cjs --phase=BUILD --step=N --story=Story-X.Y --target=<project>
```

| Phase | 名稱 | 職責 |
|-------|------|------|
| 1 | 骨架檢查 | 確認骨架檔存在、環境健在 |
| 2 | 標籤驗收 | 掃 src，P0/P1 函式必須有 GEMS 標籤（The Enforcer）|
| 3 | 測試腳本 | 輸出測試模板，AI 填充測試案例 |
| 4 | Test Gate | 測試檔存在、import 被測函式正確 |
| 5 | TDD 執行 | 跑測試，失敗 → @BLOCKER |
| 6 | 整合測試 | 跨模組整合測試 |
| 7 | 整合檢查 | 路由/模組匯出/依賴關係 |
| 8 | Fillback | 產出 Fillback.md + iteration_suggestions.json，AC 覆蓋檢查 |

---

## 四、腳本地圖

### sdid-tools/（Blueprint Flow 工具）

| 腳本 | 功能 |
|------|------|
| `blueprint-gate.cjs` | 藍圖品質驗收（15 項機械規則）|
| `blueprint-verify.cjs` | 逐行核對 draft vs 源碼，AC 未標記 → @WARN |
| `blueprint-shrink.cjs` | 壓縮 draft → 錨點格式 |
| `blueprint-expand.cjs` | 展開下一個 iter |
| `draft-to-plan.cjs` | Enhanced Draft → implementation_plan + 骨架 |
| `plan-to-scaffold.cjs` | Plan → .ts/.tsx 骨架檔（type-aware）|
| `poc-to-scaffold.cjs` | consolidation-log → .ts/.tsx 骨架檔（POC-FIX 用）|
| `micro-fix-gate.cjs` | 輕量驗收（GEMS 標籤 + import 不斷鏈），寫 log |
| `cynefin-log-writer.cjs` | 複雜度評估記錄 |
| `state-guide.cjs` | AI session 入口，輸出「指令包」|
| `lib/draft-parser-standalone.cjs` | Enhanced Draft 解析器 |
| `lib/consolidation-parser.cjs` | poc-consolidation-log.md 解析器 |

### task-pipe/（BUILD 引擎）

| 腳本 | 功能 |
|------|------|
| `runner.cjs` | 統一入口，根據 phase/step/story 呼叫對應腳本 |
| `loop.cjs` | 狀態導航（已 deprecated，改用 MCP sdid-loop）|
| `phases/build/phase-1~8.cjs` | BUILD 八關實作 |
| `phases/poc/step-1~5.cjs` | Task-Pipe POC 步驟 |
| `phases/plan/step-1~5.cjs` | Task-Pipe PLAN 步驟 |
| `phases/scan/scan.cjs` | SCAN 全專案掃描 |
| `lib/scan/gems-scanner-unified.cjs` | GEMS 標籤掃描（支援 shrink 格式 + acIds）|
| `lib/plan/plan-validator.cjs` | Plan 格式驗證（Rule 10: P0/P1 缺 AC → WARNING）|
| `lib/shared/log-output.cjs` | 統一輸出引擎（anchorPass/anchorError/emitTaskBlock）|
| `lib/shared/state-manager-v3.cjs` | .state.json 讀寫，狀態機 |
| `lib/shared/project-memory.cjs` | 歷史記憶（pitfall/hint）|
| `tools/shrink-tags.cjs` | GEMS 標籤壓縮工具 |
| `tools/health-report.cjs` | 專案健康報告 |

### sdid-core/（共用核心）

| 腳本 | 功能 |
|------|------|
| `state-machine.cjs` | 統一狀態推斷引擎（detectRoute/inferStateFromLogs/detectFullState）|
| `architecture-contract.cjs` | 架構契約定義 |

### sdid-tools/mcp-server/（MCP 介面）

| Tool | 對應 CLI | 功能 |
|------|----------|------|
| `sdid-loop` | loop adapter | ★主入口：自動偵測狀態執行下一步 |
| `sdid-state-guide` | state-guide.cjs | AI session 指令包 |
| `sdid-blueprint-gate` | blueprint-gate.cjs | 藍圖驗收 |
| `sdid-micro-fix-gate` | micro-fix-gate.cjs | 小修驗收（支援 --iter）|
| `sdid-poc-scaffold` | poc-to-scaffold.cjs | POC-FIX 骨架遷移 |
| `sdid-build` | runner.cjs | BUILD/POC/PLAN 執行 |
| `sdid-scan` | scan.cjs | SCAN 執行 |
| `sdid-run` | 通用 | 安全白名單 CLI 執行器 |
| `sdid-spec-gen` | spec-gen.cjs | 字典生成（舊路線）|
| `sdid-spec-gate` | spec-gate.cjs | 字典品質驗證（舊路線）|
| `sdid-scanner` | gems-scanner-unified.cjs | GEMS 標籤掃描 |
| `sdid-dict-sync` | dict-sync.cjs | 字典行號回寫（舊路線）|

---

## 五、狀態推斷機制

`sdid-core/state-machine.cjs` 是唯一真相源，合併三套重疊邏輯：

```
優先順序：
  1. .state.json（state-manager-v3 ledger）
  2. last_step_result.json
  3. log-based inference（inferStateFromLogs）
  4. draft 存在 → GATE
```

路線偵測（`detectRoute`）：

| 標記文件 | 路線 |
|---------|------|
| `poc/poc-consolidation-log.md` | POC-FIX |
| `poc/requirement_draft_iter-N.md` | Blueprint |
| `requirement-spec.md` | Task-Pipe |
| 無 | Unknown |

Log 前綴與狀態對應（`inferStateFromLogs`）：

| Log 前綴 | 推斷狀態 |
|---------|---------|
| `gate-verify-pass-` | NEXT_ITER 或 COMPLETE |
| `gate-shrink-pass-` | VERIFY 或 BUILD 下一個 Story |
| `build-phase-8-Story-X.Y-pass-` | SHRINK 或 BUILD 下一個 Story |
| `gate-plan-pass-` | BUILD Phase 1 |
| `gate-check-pass-` | PLAN |
| `gate-check-error-` | GATE（重試）|
| `gate-microfix-pass-` | POC-FIX/MICRO-FIX 完成記錄 |

---

## 六、AC 閉環資料流

AC（驗收條件）從 Draft 一路穿透到源碼標記，全程機械追蹤：

```
Enhanced Draft
  AC-9.2: Given/When/Then 完整描述
  │
  ▼ draft-parser-standalone.cjs
  解出 action.ac = "AC-9.2"
  │
  ▼ draft-to-plan.cjs
  Plan 裡插入: // AC-9.2
  │
  ▼ plan-to-scaffold.cjs
  骨架檔帶: // AC-9.2（在 GEMS 標籤後、[STEP] 前）
  │
  ▼ AI 實作
  源碼保留: // AC-9.2
  │
  ▼ gems-scanner-unified.cjs
  fn.acIds = ["AC-9.2"]（機械識別）
  │
  ├── phase-8.cjs Check 2
  │   Plan AC vs 源碼 acIds 比對 → AC_NOT_TAGGED (WARNING)
  │                              → AC_UNCOVERED (WARNING)
  │
  └── blueprint-verify.cjs checkACCoverage()
      Plan AC vs 源碼 acIds 比對
      全標記 → @PASS
      有未標記 → @WARN（TACTICAL_FIX）
```

---

## 七、資料目錄結構

```
{project}/
├── src/                          ← 實際程式碼
├── .gems/
│   ├── iterations/
│   │   └── iter-N/
│   │       ├── .state.json       ← 流程狀態（state-manager-v3）
│   │       ├── poc/
│   │       │   ├── requirement_draft_iter-N.md  ← Blueprint 識別標記
│   │       │   └── poc-consolidation-log.md     ← POC-FIX 識別標記
│   │       ├── plan/
│   │       │   └── implementation_plan_Story-X.Y.md
│   │       ├── build/
│   │       │   ├── Fillback_Story-X.Y.md
│   │       │   └── iteration_suggestions_Story-X.Y.json
│   │       └── logs/
│   │           ├── gate-check-{pass|error}-{ts}.log
│   │           ├── gate-plan-{pass|error}-{ts}.log
│   │           ├── build-phase-N-Story-X.Y-{pass|error}-{ts}.log
│   │           ├── gate-shrink-{pass|error}-{ts}.log
│   │           ├── gate-verify-{pass|error}-{ts}.log
│   │           └── gate-microfix-{pass|error}-{ts}.log  ← POC-FIX/MICRO-FIX
│   ├── docs/
│   │   ├── functions.json        ← gems-scanner-unified 輸出
│   │   ├── blueprint-verify.json ← blueprint-verify 報告
│   │   └── BLUEPRINT_VERIFY.md
│   └── project-memory.json       ← 歷史記憶（pitfall/hint）
```

---

## 八、MCP Loop 自動偵測流程

`sdid-loop` MCP tool 是主入口，每次呼叫自動：

1. 偵測最新 iter
2. `detectRoute()` 判斷路線
3. `inferBlueprintState()` 推斷當前 phase
4. 執行對應工具
5. 回傳輸出 + @TASK / @PASS / @BLOCKER 指示

```
sdid-loop(project=<path>)
  │
  ├── phase=GATE     → blueprint-gate.cjs
  ├── phase=PLAN     → draft-to-plan.cjs
  ├── phase=BUILD    → runner.cjs --phase=BUILD --step=N
  ├── phase=SHRINK   → blueprint-shrink.cjs
  ├── phase=VERIFY   → blueprint-verify.cjs
  ├── phase=NEXT_ITER → blueprint-expand.cjs
  ├── phase=POC-FIX  → micro-fix-gate.cjs（forceStart 進入）
  └── phase=MICRO-FIX → micro-fix-gate.cjs（forceStart 進入）
```

---

## 九、快速指令參考

```bash
# Blueprint Flow
node sdid-tools/blueprint/gate.cjs --draft=<path> --target=<project> --iter=N
node sdid-tools/blueprint/draft-to-plan.cjs --draft=<path> --iter=N --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=<project>
node sdid-tools/blueprint/shrink.cjs --draft=<path> --iter=N --target=<project>
node sdid-tools/blueprint/verify.cjs --draft=<path> --target=<project> --iter=N

# POC-FIX Phase 4
node sdid-tools/poc-to-scaffold.cjs --log=<consolidation-log.md> --target=<project>
node sdid-tools/poc-fix/micro-fix-gate.cjs --changed=<files> --target=<project> --iter=N

# MICRO-FIX
node sdid-tools/poc-fix/micro-fix-gate.cjs --changed=<files> --target=<project> --iter=N

# 骨架工具
node sdid-tools/plan-to-scaffold.cjs --plan=<plan.md> --target=<project> --dry-run
node task-pipe/tools/shrink-tags.cjs --target=<project> --dry-run

# 狀態查詢
node sdid-tools/state-guide.cjs --project=<project>
node task-pipe/tools/project-status.cjs --target=<project>

# 監控
node sdid-monitor/server.cjs   # http://localhost:3737
```

---

## 十、Skill 路由（AI 進入點）

`.agent/skills/sdid/SKILL.md` 是 AI 的路由器，根據使用者意圖決定走哪條路線：

| 條件 | 模式 | 動作 |
|------|------|------|
| 「小修」「fix」「改一下」 | MICRO-FIX | 直接改 → micro-fix-gate |
| 第三方串接、客製化演算法 | POC-FIX | 讀 poc-fix.md 四階段 |
| 有 draft，無 plan | BUILD-AUTO | sdid-loop 自動偵測 |
| 有 implementation_plan | BUILD-AUTO | sdid-loop 自動偵測 |
| 需求模糊，無專案 | DESIGN-BLUEPRINT | 5 輪對話收斂需求 |
| 需求明確，無專案 | DESIGN-TASKPIPE | sdid-loop 自動走 Task-Pipe |

---

## 十一、GEMS 標籤格式

```typescript
/**
 * GEMS: functionName | P[0-3] | ✓✓ | (args)→Result | Story-X.X | 描述
 * GEMS-FLOW: Step1→Step2→Step3
 * GEMS-DEPS: [Type.Name (說明)]
 * GEMS-DEPS-RISK: LOW | MEDIUM | HIGH
 */
// AC-X.Y                    ← 驗收條件 ID（在標籤後、[STEP] 前）
// [STEP] Step1              ← P0/P1 強制，P2/P3 可選
// [STEP] Step2
export function functionName(...) { ... }
```

Shrink 格式（`shrink-tags.cjs` 壓縮後）：

```typescript
// GEMS: functionName | P1 | FLOW: Step1→Step2
// AC-X.Y
// [STEP] Step1
export function functionName(...) { ... }
```
