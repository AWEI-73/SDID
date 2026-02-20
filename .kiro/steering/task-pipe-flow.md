---
inclusion: always
---

# Task-Pipe Flow v2.4 - AI 協作開發框架

**核心理念**: 腳本 print → AI 讀取 → AI 執行 → 重複直到 @PASS

## 🎯 統一入口：SDID Skill

使用者提到 SDID、Blueprint、藍圖、POC、PLAN、BUILD、SCAN、開發、繼續、新專案時，
**優先使用 `.agent/skills/sdid/` skill**。它會自動判斷路線：

- 路線 A（Blueprint）：大藍圖設計 → Enhanced Draft → Gate → Plan → BUILD
- 路線 B（Task-Pipe）：POC 漸進式設計 → requirement_spec → Plan → BUILD
- 兩條路在 implementation_plan 匯流，共用 BUILD Phase 1-8

舊的 sdid-loop、blueprint-loop、blueprint-architect skill 已 deprecated，不要使用。

## 🔄 流程選項

```
選項 A (Blueprint Flow，推薦): Gem 對話 → Gate → draft-to-plan → BUILD → Shrink → Verify
選項 B (Task-Pipe Flow): POC → PLAN → BUILD → SCAN
選項 C (無 POC): PLAN (自產需求規格) → BUILD → SCAN
```

## 📋 判斷任務類型

| 類型 | 關鍵字 |
|------|--------|
| Blueprint | 藍圖、blueprint、gate、draft-to-plan、shrink、expand、verify |
| POC | POC、原型、prototype、概念驗證、契約設計 |
| PLAN | 規劃、plan、需求、設計、implementation plan |
| BUILD | 開發、build、coding、實作、測試、修正 |
| SCAN | 掃描、scan、更新規格 |

## 🚀 Task-Pipe Runner 使用

### 基本指令格式
```bash
node task-pipe/runner.cjs --phase=<PHASE> --step=<N> --target=<path> [options]
```

### 常用選項
- `--phase=<POC|PLAN|BUILD|SCAN>` - 階段
- `--step=<N>` - 步驟編號
- `--level=<S|M|L>` - 檢查深度（預設: M）
- `--target=<path>` - 目標專案路徑
- `--iteration=<iter-N>` - 迭代編號
- `--ai` - AI 模式（優化輸出格式）
- `--dry-run` - 預覽模式

### 範例
```bash
# POC Step 1 (模糊消除)
node task-pipe/runner.cjs --phase=POC --step=5 --target=. --level=M

# PLAN Step 1 (需求確認)
node task-pipe/runner.cjs --phase=PLAN --step=1 --target=.

# BUILD Phase 1 (骨架檢查)
node task-pipe/runner.cjs --phase=BUILD --step=1 --target=.

# SCAN (全專案掃描)
node task-pipe/runner.cjs --phase=SCAN --target=.
```

## � Blueprint Flow (路線 A)

### 流程概覽
```
Gem 對話 → Gate → draft-to-plan → BUILD (Phase 1-8) → Shrink → [Expand → Gate → ...] → Verify
```

### 指令格式
```bash
# 1. Gate 門控
node sdid-tools/blueprint-gate.cjs --draft=<path> --target=<project> [--iter=N]

# 2. 藍圖→Plan
node sdid-tools/draft-to-plan.cjs --draft=<path> --iter=N --target=<project>

# 3. BUILD (與 Task-Pipe 共用)
node task-pipe/runner.cjs --phase=BUILD --step=1~8 --story=Story-X.Y --target=<project>

# 4. 收縮
node sdid-tools/blueprint-shrink.cjs --draft=<path> --iter=N --target=<project>

# 5. 展開 (進入下一個 iter)
node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=N --target=<project>

# 6. 驗證
node sdid-tools/blueprint-verify.cjs --draft=<path> --target=<project> --iter=N
```

### Log 讀取規則 (Blueprint Flow)

所有 sdid-tools 門控結果存檔到 `.gems/iterations/iter-X/logs/`，與 BUILD 的 log 匯流。

| 工具 | log 前綴 | 範例 |
|------|---------|------|
| blueprint-gate | `gate-check-` | `gate-check-error-2026-02-13T04-03-33.log` |
| draft-to-plan | `gate-plan-` | `gate-plan-pass-2026-02-13T04-03-34.log` |
| blueprint-shrink | `gate-shrink-` | `gate-shrink-pass-2026-02-13T04-03-35.log` |
| blueprint-expand | `gate-expand-` | `gate-expand-pass-2026-02-13T04-03-35.log` |
| blueprint-verify | `gate-verify-` | `gate-verify-pass-2026-02-13T04-03-36.log` |
| BUILD Phase 1-8 | `build-phase-` | `build-phase-2-Story-1.0-error-...log` |

### Blueprint Flow 錯誤處理

1. 執行 sdid-tools 門控指令
2. 讀取終端輸出的 `@PASS` 或 `@BLOCKER`
3. 如果 `@BLOCKER`:
   - 讀取 `logs/gate-check-error-*.log` 取得完整詳情
   - 根據 `@ERROR_SPEC` 或 `@GATE_SPEC` 修復目標檔案
   - 重跑門控指令
4. 如果 `@PASS`:
   - 讀取終端輸出的「下一步」指令
   - 執行下一步

### ⚠️ Blueprint Flow BUILD 輸出銜接規則

BUILD Phase 1-8 共用 task-pipe 的 runner.cjs，其輸出提示是為 Task-Pipe Flow 設計的。
在 Blueprint Flow 中，**忽略 BUILD Phase 8 的「下一步: SCAN」指令**：

| BUILD 輸出 | Blueprint Flow 正確行為 |
|-----------|----------------------|
| `下一步: BUILD --step=N` | ✅ 正確，繼續下一個 Phase |
| `下一步: SCAN` | ❌ 忽略！重新執行 `loop.cjs` |
| BUILD Phase 8 @PASS | 重新執行 `loop.cjs`（自動偵測下一個 Story 或 SHRINK） |

**黃金法則**: 永遠透過 `loop.cjs` 執行下一步，不要直接跑 BUILD 輸出的指令。

### SCAN→Blueprint 增量替代

Blueprint Flow 不使用 SCAN 階段，取而代之：

| Task-Pipe Flow | Blueprint Flow 對應 |
|---------------|-------------------|
| SCAN (全專案掃描) | SHRINK + VERIFY |
| SCAN → 下一個 iteration | EXPAND → 下一個 iter |

### Blueprint Flow 完整循環

```
Gate @PASS → draft-to-plan @PASS → BUILD Phase 1-8 (每個 Story) → Shrink @PASS
  ↓ (如果有下一個 iter)
Expand @PASS → Gate @PASS → draft-to-plan @PASS → BUILD → Shrink → ...
  ↓ (最後)
Verify @PASS → 完成
```

---

## 📚 POC 階段 (Step 1-5)

### Step 1: 模糊消除
```bash
node task-pipe/runner.cjs --phase=POC --step=5 --target=. --level=M
```
- 讀取 `requirement_draft_iter-X.md`
- 輸出 `@NEEDS_CLARIFICATION` 或 `@PASS`
- 產出: 更新的 `requirement_draft_iter-X.md`

### Step 2: 規模評估
```bash
node task-pipe/runner.cjs --phase=POC --step=4 --target=.
```
- 評估專案規模 (S/M/L)
- 檢查 Story 數量限制

### Step 3: 契約設計
```bash
node task-pipe/runner.cjs --phase=POC --step=5 --target=.
```
- 產出: `@GEMS-CONTRACT` 型別定義
- 包含 DB 型別註解

### Step 4: UI 原型
```bash
node task-pipe/runner.cjs --phase=POC --step=4 --target=.
```
- 產出: `xxxPOC.html` + `@GEMS-DESIGN-BRIEF`
- **必須包含 `@GEMS-VERIFIED` 標籤**

### Step 5: 需求規格
```bash
node task-pipe/runner.cjs --phase=POC --step=5 --target=.
```
- 讀取 `@GEMS-VERIFIED` 標籤
- 產出: `requirement_spec_iter-X.md`
- 已驗證功能 `[x]` → iter-1
- 未驗證功能 `[ ]` → DEFERRED 或計畫開發

## 📚 PLAN 階段 (Step 1-5)

### Step 1: 需求確認
```bash
node task-pipe/runner.cjs --phase=PLAN --step=1 --target=.
```
- 確認需求，模糊消除

### Step 2: 規格注入
```bash
node task-pipe/runner.cjs --phase=PLAN --step=2 --target=.
```
- 讀取 POC 產出（如有）
- 生成 `implementation_plan_Story-X.Y.md`

### Step 3: 架構審查
```bash
node task-pipe/runner.cjs --phase=PLAN --step=5 --target=.
```
- Constitution Audit
- 產出: `architecture_audit.md`

### Step 4: 標籤規格設計
```bash
node task-pipe/runner.cjs --phase=PLAN --step=4 --target=.
```
- 設計 GEMS 標籤規格
- 注入到 implementation_plan

### Step 5: 需求規格說明
```bash
node task-pipe/runner.cjs --phase=PLAN --step=5 --target=.
```
- 最終確認與說明

## 📚 BUILD 階段 (Phase 1-8)

### Phase 1: 骨架檢查
```bash
node task-pipe/runner.cjs --phase=BUILD --step=1 --target=.
```
- 確保環境和檔案結構存在

### Phase 2: 標籤驗收 ⭐
```bash
node task-pipe/runner.cjs --phase=BUILD --step=2 --target=.
```
- **The Enforcer**: 掃描 src 確保每個函數符合 GEMS 標籤
- 不符合 → FAIL

### Phase 3: 測試腳本
```bash
node task-pipe/runner.cjs --phase=BUILD --step=3 --target=.
```
- 寫測試檔案

### Phase 4: Test Gate
```bash
node task-pipe/runner.cjs --phase=BUILD --step=4 --target=.
```
- 驗證測試檔案存在且 import 被測函式

### Phase 5: TDD 測試執行
```bash
node task-pipe/runner.cjs --phase=BUILD --step=5 --target=.
```
- Unit/Integration 測試

### Phase 6: 修改檔案測試
```bash
node task-pipe/runner.cjs --phase=BUILD --step=6 --target=.
```
- 整合測試

### Phase 7: 整合檢查
```bash
node task-pipe/runner.cjs --phase=BUILD --step=7 --target=.
```
- 檢查路由、模組匯出等整合項目

### Phase 8: Fillback
```bash
node task-pipe/runner.cjs --phase=BUILD --step=8 --target=.
```
- 生成 `Fillback_Story-X.Y.md`
- 產出: `iteration_suggestions_Story-X.Y.json`

## 📚 SCAN 階段

```bash
node task-pipe/runner.cjs --phase=SCAN --target=.
```
- 全專案掃描
- 驗證標籤 + 規格一致性
- 產出: 掃描報告

## 🔴 通用軍規

1. **禁止腦補**: 模糊需求必須先 `[NEEDS CLARIFICATION]`
2. **小跑修正**: SEARCH → 修正 → 重試，最多 3 次
3. **不跳步**: POC Step 1-5 / PLAN Step 1-5 / BUILD Phase 1-8 都不能跳
4. **Context 管理**: 一個 Agent 一個 Item
5. **驗證優先**: 每個階段都有 Checkpoint
6. **獨立可測性**: 每個 Story 必須能被單獨驗證

## 🤖 AI 行為約束 (v2.5 新增)

收到腳本輸出時，AI 必須遵守以下行為規則：

1. **收到 @TASK 區塊時**：直接根據 ACTION + FILE + EXPECTED 執行修復，禁止回讀架構文件或 plan 文件來「理解全貌」
2. **收到 @NEXT_COMMAND 時**：修復完成後立即執行該命令，不要自行組裝命令
3. **收到 @REMINDER 時**：這是關鍵指令的重複確認，確保沒有遺漏任何 TASK
4. **沒有 @TASK 區塊時**：才允許讀取 plan 文件或架構文件來理解需求
5. **收到 @FORBIDDEN 時**：嚴格遵守禁止事項，不得以任何理由違反

**核心原則**：腳本已完成所有分析，AI 不需要重新分析，只需執行。

## ⚡ Quick Mode 中斷處理 (v2.7 新增)

AI 正在跑 sdid-loop 流程中，使用者插入不相關請求時：
1. 先完成當前 phase 修復循環再處理
2. 使用者堅持 → 暫停流程，提醒「BUILD Phase N 進行中，處理完你的請求後我會繼續」
3. 處理完後說「sdid 繼續」→ loop.cjs 讀 state → @RESUME → 從斷點接

## 🚫 編碼安全規則 (v2.3 新增)

**禁止使用 PowerShell 進行檔案批量操作**，會導致編碼災難：

```powershell
# ❌ 禁止 - 會破壞 UTF-8 編碼
Get-Content file.ts | ForEach-Object { $_ -replace 'old', 'new' } | Set-Content file.ts
(Get-Content file.ts) -replace 'old', 'new' | Out-File file.ts

# ✅ 正確 - 使用 Node.js 腳本
node task-pipe/tools/safe-replace.cjs <file> <content>
```

**BUILD Phase 2 會自動檢查編碼**：
- 偵測 UTF-8 BOM
- 偵測亂碼 (Mojibake)
- 偵測無效控制字元
- 編碼問題 = BLOCKER，必須先修復

**修復方式**：
1. `node task-pipe/tools/safe-replace.cjs <file>` - 安全重寫
2. 在編輯器中另存為 UTF-8 (無 BOM)

## 🎨 POC 核心：@GEMS-VERIFIED 標籤

**POC 必須明確標註哪些功能已實作、哪些未實作**：

```html
<!--
  @GEMS-VERIFIED: (此 POC 驗證的功能)
  - [x] 產品列表顯示
  - [x] 新增產品功能
  - [x] 刪除產品功能
  - [ ] 產品編輯功能 (未實作)
  - [ ] 搜尋篩選功能 (未實作)
-->
```

**等級限制**:
| Level | 最大 Stories | Story 0 範圍 | 未驗證功能處理 |
|-------|-------------|--------------|---------------|
| S | 3 | 必要型別 + Mock | 自動 DEFERRED |
| M | 6 | 專案骨架 + 配置 | 標註計畫開發 |
| L | 10 | 完整基礎建設 | 允許進入 iter-1 |

## 🎨 契約設計：@GEMS-CONTRACT

`@GEMS-CONTRACT` 必須包含 DB 型別註解：

```typescript
// @GEMS-CONTRACT: EntityName
// @GEMS-TABLE: tbl_table_name
interface EntityName {
  id: string;           // UUID, PK
  fieldName: string;    // VARCHAR(100), NOT NULL
  status: EntityStatus; // ENUM('DRAFT','ACTIVE')
}
```

BUILD 時 AI 根據這些註解自行推導 Schema 和 API。

## 🏷️ GEMS 標籤 (v2.1)

```typescript
/**
 * GEMS: functionName | P[0-3] | ✓✓ | (args)→Result | Story-X.X | 描述
 * GEMS-FLOW: Step1→Step2→Step3
 * GEMS-DEPS: [Type.Name (說明)], [Type.Name (說明)]
 * GEMS-DEPS-RISK: LOW | MEDIUM | HIGH
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: xxx.test.ts
 */
// [STEP] Step1 (P0/P1 強制，P2/P3 可選)
// [STEP] Step2
// [STEP] Step3
```

**v2.1 變更**：
- ✅ 移除 `GEMS-ALGO`（由 Requirement Spec 的 Scenario Table 承載）
- ✅ P0/P1 必須有 `[STEP]` 錨點與 `GEMS-FLOW` 對應
- ✅ DEPS 採折衷格式：`[Type.Name (說明)]` 或 `[Type.Name]`

## 🚨 錯誤處理 (v2.4 策略漂移)

### 三層策略漂移 (Strategy Drift)

重試不是單純重複，而是「維度的提升」：

| Level | 重試次數 | 策略名稱 | 行動 |
|-------|---------|---------|------|
| 1 | 1-3 次 | TACTICAL_FIX | 局部修補，在原檔案修復 |
| 2 | 4-6 次 | STRATEGY_SHIFT | 換個方式實作，考慮重構 |
| 3 | 7+ 次 | PLAN_ROLLBACK | 質疑架構，回退 PLAN 階段 |

### 優先級重試上限

| Priority | 最大重試 | 升級門檻 |
|----------|---------|---------|
| P0 | 10 次 | 第 4 次升級 |
| P1 | 8 次 | 第 3 次升級 |
| P2 | 5 次 | 第 2 次升級 |
| P3 | 3 次 | 第 2 次升級 |

### 染色分析 (Taint Analysis)

修改 P0 函式後，自動計算影響範圍：

```bash
# 分析影響範圍
node task-pipe/lib/shared/taint-analyzer.cjs --functions=.gems/docs/functions.json --changed=src/auth.ts
```

輸出：
- 直接修改的函式
- 間接受影響的函式 (依賴者)
- 需要驗證的檔案列表

### 增量驗證 (Incremental Validation)

修改後不需從頭跑，只驗證改動範圍：

```bash
# 增量驗證
node task-pipe/lib/shared/incremental-validator.cjs --changed=src/auth.ts --phase=5
```

驗證範圍根據當前 Phase：
- Phase 2+: 標籤驗證
- Phase 5+: 測試驗證
- Phase 7+: 整合驗證

### 遞迴回溯 (Recursive Backtracking)

失敗類型 → 精確回溯目標：

| 失敗類型 | 回溯目標 |
|---------|---------|
| 標籤缺失 | BUILD Phase 2 |
| 測試失敗 | BUILD Phase 3-5 |
| 整合失敗 | BUILD Phase 6-7 |
| 架構問題 | PLAN Step 2-3 |

```bash
# 分析失敗並決定回溯
node task-pipe/lib/shared/backtrack-router.cjs --failures=failures.json
```

### 工具腳本

```bash
# 策略漂移追蹤
node task-pipe/lib/shared/retry-strategy.cjs --phase=BUILD --step=5 --error="Test failed"

# 染色分析
node task-pipe/lib/shared/taint-analyzer.cjs --functions=<path> --changed=<files>

# 增量驗證
node task-pipe/lib/shared/incremental-validator.cjs --changed=<files> --phase=<N>

# 回溯路由
node task-pipe/lib/shared/backtrack-router.cjs --failures=<json>
```

### 在 Phase 腳本中使用

```javascript
// 基本用法 (向後相容)
const { createErrorHandler, handlePhaseSuccess } = require('../../lib/shared/error-handler.cjs');
const handler = createErrorHandler('BUILD', '5', story, target);

// 進階用法 (v2.0 策略漂移)
const { handleAdvancedError, runIncrementalValidation } = require('../../lib/shared/error-handler.cjs');

// 記錄錯誤並取得策略建議
const result = handleAdvancedError({
  phase: 'BUILD',
  step: '5',
  story: 'Story-1.0',
  target: projectRoot,
  iteration: 'iter-1',
  priority: 'P1',
  error: { message: 'Test failed', type: 'TEST_FAIL' },
  changedFiles: ['src/auth.ts']
});

// result.strategyLevel: 1=TACTICAL_FIX, 2=STRATEGY_SHIFT, 3=PLAN_ROLLBACK
// result.verdict: PENDING | BLOCKER | PLAN_ROLLBACK
// result.backtrack: { phase, step, reason } 如果需要回溯
// result.impactAnalysis: 染色分析結果

// 增量驗證
const validation = runIncrementalValidation(['src/auth.ts'], {
  target: projectRoot,
  currentPhase: 5
});
```

## 📁 目錄結構

```
專案根目錄/
├── .gems/                              # 迭代產物
│   └── iterations/
│       └── iter-X/
│           ├── poc/                    # POC 階段產物
│           │   ├── requirement_draft_iter-X.md
│           │   ├── requirement_spec_iter-X.md
│           │   ├── xxxPOC.html
│           │   └── xxxContract.ts
│           ├── plan/                   # PLAN 階段產物
│           │   ├── implementation_plan_Story-X.Y.md
│           │   └── architecture_audit.md
│           ├── build/                  # BUILD 階段產物
│           │   ├── Fillback_Story-X.Y.md
│           │   └── iteration_suggestions_Story-X.Y.json
│           └── logs/                   # 執行日誌
├── task-pipe/                          # Task-Pipe 框架
│   ├── runner.cjs                      # 主入口
│   ├── phases/                         # 階段腳本
│   │   ├── poc/
│   │   ├── plan/
│   │   ├── build/
│   │   └── scan/
│   ├── lib/                            # 共用函式庫
│   ├── tools/                          # 工具腳本
│   └── docs/                           # 文件
└── src/                                # 實際專案程式碼
    └── modules/
```

## 🛠️ 工具腳本

### POC 工具
```bash
# POC 初始化
node task-pipe/tools/poc/init-poc.cjs --target=. --iteration=iter-1

# HTML POC 處理
node task-pipe/tools/poc/process-html-poc.cjs <html-file>
```

### PLAN 工具
```bash
# Plan 驗證
node task-pipe/tools/plan/plan-validator.cjs <plan.md>
```

### BUILD 工具
```bash
# Suggestions 驗證
node task-pipe/lib/suggestions-validator.cjs <suggestions.json>

# GEMS 掃描
node task-pipe/tools/scan/gems-scanner.cjs --target=src
```

### 狀態管理
```bash
# 查看狀態
node task-pipe/tools/story-status.cjs --target=.

# 重置狀態
node task-pipe/tools/story-status.cjs --target=. --reset
```

## 📖 參考文件

- `task-pipe/README.md` - 快速開始
- `task-pipe/GUIDE.md` - 完整指南
- `task-pipe/SYSTEM_OVERVIEW.md` - 系統架構
- `task-pipe/docs/BLUEMOUSE_GUIDE.md` - BlueMouse 整合
- `task-pipe/docs/PLAN_STEP2_CHECKLIST.md` - PLAN Step 2 檢查清單

## 🎯 快速參考

### 綠地專案（全新專案）
```bash
# 1. 建立專案目錄
mkdir my-project && cd my-project

# 2. 建立 .gems 結構
mkdir -p .gems/iterations/iter-1/poc

# 3. 建立 requirement_draft_iter-1.md

# 4. 執行 POC Step 1
node task-pipe/runner.cjs --phase=POC --step=5 --target=. --level=M
```

### 棕地專案（既有專案）
```bash
# 1. 進入專案目錄
cd existing-app

# 2. 建立新迭代目錄
mkdir -p .gems/iterations/iter-2/poc

# 3. (可選) 掃描現有結構
node task-pipe/runner.cjs --phase=SCAN --target=.

# 4. 建立 requirement_draft_iter-2.md

# 5. 執行 POC Step 1
node task-pipe/runner.cjs --phase=POC --step=0 --target=. --iteration=iter-2
```

### SDID Loop 自動執行
```bash
# 使用 SDID Loop skill 自動執行整個流程
# 參考: task-pipe/skills/sdid-loop/
```

## 🔗 相關專案

- **SDID Loop**: 自動化執行 Task-Pipe 流程的 skill
- **BlueMouse**: Socratic 問答引擎，用於需求澄清
- **GEMS Orchestrator MCP**: MCP 伺服器，提供 GEMS 流程工具
