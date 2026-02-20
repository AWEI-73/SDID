# Task-Pipe & Blueprint Flow — 全階段輸出對齊參考 v3.0

> v3.0 變更: Terminal Signal Only + @READ 強制讀 log + @GUARD 統一施工紅線 + NEXT: 統一指令欄位
> 更新日期: 2026-02-14

---

## 📊 v3.0 變更摘要

| 項目 | v2 (舊) | v3 (新) | 理由 |
|------|---------|---------|------|
| 成功指令 | `下一步: cmd` | `NEXT: cmd` | 統一欄位名，AI 友好 |
| 錯誤指令 | `修復後: cmd` | `NEXT: cmd` | 消除同義詞 |
| 錯誤詳情 | `詳情: path` | `@READ: path` + `↳ 包含: ...` | 強制 AI 讀 log |
| 施工紅線 | `@FORBIDDEN` / `@REPEAT-RULE` / `[MILITARY-SPECS]` (4 種) | `@GUARD` (1 種) | 統一，省 token |
| anchorErrorSpec 終端 | 印 GATE_SPEC + EXAMPLE + 分隔線 (~30 行) | 只印 TARGET + MISSING + @READ (~6 行) | 細節在 log |
| anchorTemplatePending 終端 | 印完整模板 (~50+ 行) | 只印 FILL_ITEMS + @READ (~8 行) | 模板在 log |
| Log 檔案結構 | 扁平文字 | `=== SIGNAL/TARGET/GATE_SPEC/EXAMPLE/NEXT/GUARD ===` 分段 | U 型注意力 |

---

## 📊 輸出標記總覽 (Output Markers)

| 標記 | 含義 | 出現場景 |
|------|------|---------|
| `@PASS` | 門控通過 | 所有 Phase/Step 成功時 |
| `@TACTICAL_FIX` | 局部修補，可重試 | 重試 1-3 次 |
| `@BLOCKER` | 結構性問題，必須修復 | 重試超限 / 架構問題 |
| `@ERROR_SPEC` | 精準錯誤（TARGET + MISSING + @READ） | 具體修復指引 |
| `@TEMPLATE_PENDING` | 需要 AI 填寫模板 | 新建檔案時 |
| `@TASK` | 指令式任務區塊 | emitTaskBlock 輸出 |
| `@NEXT_COMMAND` | 下一步指令 | emitTaskBlock 內 |
| `@READ` | **強制 AI 讀取 log 檔案** | 所有錯誤/模板輸出 |
| `@GUARD` | **統一施工紅線** | 所有錯誤輸出 |
| `@CONTEXT` | 精簡上下文 | anchorOutput 輸出 |
| `@INFO` | 結構化資訊 | anchorOutput 輸出 |
| `@STRATEGY_DRIFT` | 策略漂移資訊 | 重試升級時 |
| `@TAINT_ANALYSIS` | 染色分析結果 | 修改 P0 函式後 |
| `@INCREMENTAL_HINT` | 增量驗證建議 | 策略漂移時 |
| `@REMINDER` | 關鍵指令重複確認 | emitTaskBlock 結尾 |
| `@NEEDS_CLARIFICATION` | 需要澄清 | POC 模糊消除 |
| `@GEMS-VERIFIED` | POC 功能驗證標籤 | POC Step 4 |
| `@GEMS-CONTRACT` | 契約設計標籤 | POC Step 3 |

### 已移除/合併的標記

| 舊標記 | 處理 | 說明 |
|--------|------|------|
| `@FORBIDDEN` | → `@GUARD` | 統一施工紅線 |
| `@REPEAT-RULE` | → `@GUARD` | 統一施工紅線 |
| `[MILITARY-SPECS]` | → `@GUARD` | 統一施工紅線 |
| `@ARCHITECTURE_REVIEW` | 保留在 anchorOutput 內部 | 語義轉換 |
| `@ITERATION_ADVICE` | 保留在 anchorOutput 內部 | 語義轉換 |

---

## 📁 Log 檔案命名規則

```
.gems/iterations/iter-X/logs/{phase}-{step}-{story?}-{type}-{timestamp}.log
```

| 欄位 | 範例 |
|------|------|
| phase | `poc`, `plan`, `build`, `scan`, `gate-check`, `gate-plan`, `gate-shrink`, `gate-expand`, `gate-verify` |
| step | `step-1`, `phase-2`, `scan` |
| story | `Story-1.0` (PLAN/BUILD 才有) |
| type | `pass`, `error`, `error-spec`, `fix`, `template`, `info` |
| timestamp | `2026-02-14T11-30-00` |

---

## 📐 v3.0 Log 檔案結構 (error-spec)

```
=== SIGNAL ===
@ERROR_SPEC (1/3)

=== TARGET ===
FILE: src/modules/recipe/services/recipe-service.ts
MISSING: GEMS-FLOW, GEMS-DEPS

=== GATE_SPEC ===
❌ GEMS-FLOW: Step1→Step2→Step3 格式
❌ GEMS-DEPS: [Type.Name (說明)] 格式
✅ GEMS 基本標籤: 已存在

=== EXAMPLE (可直接複製) ===
/**
 * GEMS: createRecipe | P0 | ✓✓ | (title,ingredients)→Recipe | Story-1.1 | 建立食譜
 * GEMS-FLOW: ValidateInput→ProcessData→SaveToDB→ReturnResult
 * GEMS-DEPS: [Service.StorageService (資料存取)]
 */

=== NEXT ===
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-1.0

=== GUARD ===
🚫 禁止修改 task-pipe/ 和 sdid-tools/ | ✅ 只能修改 TARGET 檔案
```

## 📐 v3.0 Log 檔案結構 (template)

```
=== SIGNAL ===
@TEMPLATE_PENDING

=== TARGET ===
FILE: .gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md

=== GATE_SPEC (填寫後會檢查) ===
⏳ Story 目標: /Story 目標|一句話目標/i
⏳ 工作項目: /工作項目|Item.*\|/i

=== FILL_ITEMS ===
1. Story 目標
2. 工作項目表格
3. 規格注入

=== TEMPLATE (可直接複製) ===
{完整模板內容}

=== NEXT ===
node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-1.0

=== GUARD ===
🚫 禁止修改 task-pipe/ 和 sdid-tools/ | ✅ 只能修改 TARGET 檔案
```

---

## 🔵 路線 B: Task-Pipe Flow — 終端輸出範例

### ═══════════════════════════════════════
### 通用格式
### ═══════════════════════════════════════

#### @PASS 輸出 (所有 Phase/Step)
```
@PASS | {phase} {step} | {summary}
NEXT: {command}
```

#### @ERROR_SPEC 輸出 (v3.0 精簡版)
```
@ERROR_SPEC (1/3) | {phase} {step} | 缺少: {items}
TARGET: {file_path}
MISSING: {item1}, {item2}
@READ: .gems/iterations/iter-X/logs/{phase}-{step}-{story}-error-spec-{timestamp}.log
  ↳ 包含: GATE_SPEC 檢查項 + 修復範例 + 缺失明細
NEXT: {command}
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ {target_file}
```

#### @TEMPLATE_PENDING 輸出 (v3.0 精簡版)
```
@TEMPLATE_PENDING | {phase} {step} | 需填寫 N 個項目
TARGET: {file_path}
FILL_ITEMS:
  1. {item1}
  2. {item2}
  3. {item3}
@READ: .gems/iterations/iter-X/logs/{phase}-{step}-{story}-template-{timestamp}.log
  ↳ 包含: 完整模板 + GATE_SPEC 檢查項
NEXT: {command}
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ {target_file}
```

#### @TACTICAL_FIX 輸出 (anchorError)
```
@TACTICAL_FIX (1/3) | {summary}
@STRATEGY_DRIFT | Level 1/3 | 🔧 TACTICAL_FIX    (策略漂移時才有)
NEXT: {command}
@READ: .gems/iterations/iter-X/logs/{phase}-{step}-{story}-error-{timestamp}.log
  ↳ 包含: 錯誤詳情 + 策略建議 + 修復指引
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ 專案檔案
```

#### @BLOCKER 輸出 (emitTaskBlock)
```
═══════════════════════════════════════════════════════════
@BLOCKER | N item(s) to fix
@CONTEXT: {context}
═══════════════════════════════════════════════════════════

@TASK-1
  ACTION: {action}
  FILE: {file}
  EXPECTED: {expected}
  REFERENCE: {reference}

@TASK-2
  ACTION: {action}
  FILE: {file}
  EXPECTED: {expected}

@NEXT_COMMAND
  {command}

@REMINDER
  - {action1} {file1}
  - {action2} {file2}
  NEXT: {command}

@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ 專案檔案
═══════════════════════════════════════════════════════════
```

---

### ═══════════════════════════════════════
### POC 階段 (Step 1-5)
### ═══════════════════════════════════════

#### POC Step 1: 模糊消除 + 邏輯預檢

```
輸入: requirement_draft_iter-X.md
產物: 驗證過的 draft
指令: node task-pipe/runner.cjs --phase=POC --step=1 --target=<path>
```

**@PASS:**
```
@PASS | POC Step 1 | Draft 驗證通過，{N} 個功能需求已確認
NEXT: node task-pipe/runner.cjs --phase=POC --step=2 --target=<path>
```

**@TACTICAL_FIX (draft 不存在):**
```
@TACTICAL_FIX (1/3) | 未找到 requirement_draft_iter-X.md
NEXT: node task-pipe/runner.cjs --phase=POC --step=1 --target=<path>
@READ: .gems/iterations/iter-X/logs/poc-step-1-error-{timestamp}.log
  ↳ 包含: 錯誤詳情 + 修復指引
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ 專案檔案
```

---

#### POC Step 3: 契約設計

**@ERROR_SPEC (標籤缺失):**
```
@ERROR_SPEC (1/3) | poc step-3 | 缺少: @GEMS-CONTRACT, @GEMS-TABLE, @GEMS-FUNCTION
TARGET: .gems/iterations/iter-X/poc/xxxContract.ts
MISSING: @GEMS-CONTRACT, @GEMS-TABLE, @GEMS-FUNCTION
@READ: .gems/iterations/iter-X/logs/poc-step-3-error-spec-{timestamp}.log
  ↳ 包含: GATE_SPEC 檢查項 + 修復範例 + 缺失明細
NEXT: node task-pipe/runner.cjs --phase=POC --step=3
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ .gems/iterations/iter-X/poc/xxxContract.ts
```

---

#### POC Step 4: UI 原型設計

**@TACTICAL_FIX (品質問題):**
```
@TACTICAL_FIX (1/3) | POC 品質不足
NEXT: node task-pipe/runner.cjs --phase=POC --step=4 --target=<path>
@READ: .gems/iterations/iter-X/logs/poc-step-4-error-{timestamp}.log
  ↳ 包含: 錯誤詳情 + 策略建議 + 修復指引
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ 專案檔案
```

---

#### POC Step 5: 需求規格產出

**@ERROR_SPEC:**
```
@ERROR_SPEC (1/3) | poc step-5 | 缺少: 缺用戶故事, 缺驗收標準, 缺範疇聲明
TARGET: .gems/iterations/iter-X/poc/requirement_spec_iter-X.md
MISSING: 缺用戶故事, 缺驗收標準, 缺範疇聲明
@READ: .gems/iterations/iter-X/logs/poc-step-5-error-spec-{timestamp}.log
  ↳ 包含: GATE_SPEC 檢查項 + 修復範例 + 缺失明細
NEXT: node task-pipe/runner.cjs --phase=POC --step=5
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ .gems/.../requirement_spec_iter-X.md
```

---

### ═══════════════════════════════════════
### PLAN 階段 (Step 1-5)
### ═══════════════════════════════════════

#### PLAN Step 2: 規格注入

**@TEMPLATE_PENDING (Plan 不存在):**
```
@TEMPLATE_PENDING | plan step-2 | 需填寫 3 個項目
TARGET: .gems/iterations/iter-X/plan/implementation_plan_Story-X.Y.md
FILL_ITEMS:
  1. Story 目標
  2. 工作項目表格
  3. 規格注入 (Contract)
@READ: .gems/iterations/iter-X/logs/plan-step-2-Story-X.Y-template-{timestamp}.log
  ↳ 包含: 完整模板 + GATE_SPEC 檢查項
NEXT: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-X.Y
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ .gems/.../implementation_plan_Story-X.Y.md
```

**@ERROR_SPEC (Plan 不完整):**
```
@ERROR_SPEC (1/3) | plan step-2 | 缺少: Story 目標, 工作項目, 規格注入
TARGET: .gems/iterations/iter-X/plan/implementation_plan_Story-X.Y.md
MISSING: Story 目標, 工作項目, 規格注入
@READ: .gems/iterations/iter-X/logs/plan-step-2-Story-X.Y-error-spec-{timestamp}.log
  ↳ 包含: GATE_SPEC 檢查項 + 修復範例 + 缺失明細
NEXT: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-X.Y
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ .gems/.../implementation_plan_Story-X.Y.md
```

---

### ═══════════════════════════════════════
### BUILD 階段 (Phase 1-8)
### ═══════════════════════════════════════

#### BUILD Phase 1: 骨架建立

**@TEMPLATE_PENDING:**
```
@TEMPLATE_PENDING | build phase-1 | 需填寫 3 個項目
TARGET: src/modules/xxx/...
FILL_ITEMS:
  1. 建立目錄結構
  2. 建立骨架檔案
  3. 加入 GEMS 標籤
@READ: .gems/iterations/iter-X/logs/build-phase-1-Story-X.Y-template-{timestamp}.log
  ↳ 包含: 完整模板 + GATE_SPEC 檢查項
NEXT: node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ src/modules/xxx/...
```

---

#### BUILD Phase 2: 標籤驗收 (The Enforcer)

**@BLOCKER (emitTaskBlock):**
```
═══════════════════════════════════════════════════════════
@BLOCKER | 2 item(s) to fix
@CONTEXT: BUILD Phase 2 | Story-1.0
═══════════════════════════════════════════════════════════

@TASK-1
  ACTION: 修復 GEMS 標籤
  FILE: src/modules/xxx/services/yyy.ts
  EXPECTED: 加入完整 GEMS 標籤
  REFERENCE: .gems/iterations/iter-X/plan/implementation_plan_Story-X.Y.md

@TASK-2
  ACTION: 修復 GEMS-FLOW
  FILE: src/modules/xxx/services/zzz.ts
  EXPECTED: 加入 GEMS-FLOW 標籤

@NEXT_COMMAND
  node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y

@REMINDER
  - 修復 GEMS 標籤 src/modules/xxx/services/yyy.ts
  - 修復 GEMS-FLOW src/modules/xxx/services/zzz.ts
  NEXT: node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y

@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ 專案檔案
═══════════════════════════════════════════════════════════
```

---

#### BUILD Phase 4: Test Gate

**@ERROR_SPEC:**
```
@ERROR_SPEC (1/3) | build phase-4 | 缺少: P0 E2E 測試, P1 Integration 測試
TARGET: src/modules/xxx/services/__tests__/
MISSING: P0 E2E 測試, P1 Integration 測試
@READ: .gems/iterations/iter-X/logs/build-phase-4-Story-X.Y-error-spec-{timestamp}.log
  ↳ 包含: GATE_SPEC 檢查項 + 修復範例 + 缺失明細
NEXT: node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ src/modules/xxx/services/__tests__/
```

---

#### BUILD Phase 5: TDD 測試執行

**@TACTICAL_FIX (測試失敗):**
```
@TACTICAL_FIX (1/3) | 測試失敗: N 個 suite 失敗
NEXT: node task-pipe/runner.cjs --phase=BUILD --step=5 --story=Story-X.Y
@READ: .gems/iterations/iter-X/logs/build-phase-5-Story-X.Y-error-{timestamp}.log
  ↳ 包含: 錯誤詳情 + 策略建議 + 修復指引
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ 專案檔案
```

---

#### BUILD Phase 8: Fillback

**@TEMPLATE_PENDING:**
```
@TEMPLATE_PENDING | build phase-8 | 需填寫 2 個項目
TARGET: .gems/iterations/iter-X/build/
FILL_ITEMS:
  1. Fillback_Story-X.Y.md
  2. iteration_suggestions_Story-X.Y.json
@READ: .gems/iterations/iter-X/logs/build-phase-8-Story-X.Y-template-{timestamp}.log
  ↳ 包含: 完整模板 + GATE_SPEC 檢查項
NEXT: node task-pipe/runner.cjs --phase=BUILD --step=8 --story=Story-X.Y
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ .gems/iterations/iter-X/build/
```

---

## 🔴 路線 A: Blueprint Flow — 終端輸出範例

### Blueprint Gate

**@PASS:**
```
@PASS | gate-check | 藍圖品質合格，可進入 draft-to-plan
NEXT: node sdid-tools/draft-to-plan.cjs --draft=<path> --iter=N --target=<project>
```

**@BLOCKER:**
```
@BLOCKER (1/3) | 藍圖有 N 個結構性問題
NEXT: node sdid-tools/blueprint-gate.cjs --draft=<path> --iter=N
@READ: .gems/iterations/iter-X/logs/gate-check-error-{timestamp}.log
  ↳ 包含: 錯誤詳情 + 修復指引
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ 專案檔案
```

### Draft-to-Plan

**@PASS:**
```
@PASS | gate-plan | 已產出 N 個 Plan 檔案
NEXT: node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-N.0 --target=<project>
```

### Blueprint Shrink

**@PASS:**
```
@PASS | gate-shrink | 收縮完成，N 個模組已折疊
NEXT: node sdid-tools/blueprint-expand.cjs --draft=<path> --iter={N+1} --target=<project>
```

### Blueprint Expand

**@PASS:**
```
@PASS | gate-expand | 展開完成，N 個 Stub 已展開
NEXT: node sdid-tools/blueprint-gate.cjs --draft=<path> --iter=N --target=<project>
```

### Blueprint Verify

**@PASS:**
```
@PASS | gate-verify | 藍圖↔源碼一致
NEXT: 完成！或進入下一個 iteration
```

---

## 🚨 錯誤處理機制

### 策略漂移等級 (不變)

| Level | 重試次數 | 策略名稱 | 行動 |
|-------|---------|---------|------|
| 1 | 1-3 次 | TACTICAL_FIX | 局部修補 |
| 2 | 4-6 次 | STRATEGY_SHIFT | 換方式實作 |
| 3 | 7+ 次 | PLAN_ROLLBACK | 回退 PLAN |

### 策略漂移終端輸出 (v3.0)
```
@TACTICAL_FIX (4/8) | 標籤缺失
@STRATEGY_DRIFT | Level 2/3 | 🔄 STRATEGY_SHIFT
  策略: 換個方式 - 重新實作或拆分函式
NEXT: {command}
@READ: {log_path}
  ↳ 包含: 錯誤詳情 + 策略建議 + 修復指引
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ 專案檔案
```

---

## 📐 輸出函式 API 對照

### task-pipe/lib/shared/log-output.cjs

| 函式 | 用途 | 終端輸出 |
|------|------|---------|
| `anchorPass(phase, step, summary, nextCmd, opts)` | 成功 | `@PASS` + `NEXT:` |
| `anchorError(type, summary, nextCmd, opts)` | 錯誤 | `@{type}` + `NEXT:` + `@READ:` + `@GUARD` |
| `anchorErrorSpec(spec, opts)` | 精準錯誤 | `@ERROR_SPEC` + `TARGET:` + `MISSING:` + `@READ:` + `NEXT:` + `@GUARD` |
| `anchorTemplatePending(spec, opts)` | 模板填寫 | `@TEMPLATE_PENDING` + `TARGET:` + `FILL_ITEMS:` + `@READ:` + `NEXT:` + `@GUARD` |
| `emitTaskBlock(spec, opts)` | 指令式任務 | `@TASK` + `@NEXT_COMMAND` + `@REMINDER` + `@GUARD` |
| `anchorOutput(sections, opts)` | 完整輸出 | `@CONTEXT` + `@INFO` + `@GUARD` (error 時) |
| `outputPass(nextCmd, summary)` | 精簡成功 | `@PASS` + `NEXT:` |
| `outputError(opts)` | 精簡錯誤 | `@{type}` + `NEXT:` + `@READ:` |
| `saveLog(opts)` | 存檔 | 回傳相對路徑 |

### sdid-tools/lib/log-output.cjs

| 函式 | 用途 | 終端輸出 |
|------|------|---------|
| `anchorPass(phase, step, summary, nextCmd, opts)` | 成功 | `@PASS` + `NEXT:` |
| `anchorError(type, summary, nextCmd, opts)` | 錯誤 | `@{type}` + `NEXT:` + `@READ:` + `@GUARD` |
| `anchorErrorSpec(spec, opts)` | 精準錯誤 | `@ERROR_SPEC` + `TARGET:` + `MISSING:` + `@READ:` + `NEXT:` + `@GUARD` |
| `anchorTemplatePending(spec, opts)` | 模板填寫 | `@TEMPLATE_PENDING` + `TARGET:` + `FILL_ITEMS:` + `@READ:` + `NEXT:` + `@GUARD` |
| `anchorOutput(sections, opts)` | 完整輸出 | `@CONTEXT` + `@INFO` + `@GUARD` (error 時) |
| `outputPass(nextCmd, summary)` | 精簡成功 | `@PASS` + `NEXT:` |
| `outputError(opts)` | 精簡錯誤 | `@{type}` + `NEXT:` + `@READ:` |
| `saveLog(opts)` | 存檔 | 回傳相對路徑 |

---

## 🔑 AI 行為指引 (v3.0)

### 收到 @PASS 時
1. 執行 `NEXT:` 指令

### 收到 @ERROR_SPEC / @TACTICAL_FIX / @BLOCKER 時
1. 讀取 `@READ:` 指向的 log 檔案
2. 依據 log 中 `MISSING:` 和 `EXAMPLE:` 修復 `TARGET:` 檔案
3. 執行 `NEXT:` 指令
4. ⚠️ 不要猜測修復內容，log 裡有完整範例

### 收到 @TEMPLATE_PENDING 時
1. 讀取 `@READ:` 指向的 log 檔案取得完整模板
2. 依據 `FILL_ITEMS:` 填寫 `TARGET:` 檔案
3. 執行 `NEXT:` 指令

### 收到 @TASK 區塊時
1. 直接根據 ACTION + FILE + EXPECTED 執行修復
2. 執行 `@NEXT_COMMAND` 指令
3. 禁止回讀架構文件來「理解全貌」

### @GUARD 規則 (所有場景)
- 🚫 禁止修改 task-pipe/ 和 sdid-tools/
- 🚫 禁止讀取工具腳本源碼
- 🚫 禁止修改 .gems/iterations/*/logs/
- ✅ 只能修改 TARGET 指定的檔案或專案業務檔案

---

## 🔑 Blueprint Flow 黃金法則

> BUILD Phase 8 的「NEXT: SCAN」指令在 Blueprint Flow 中必須忽略。
> 永遠透過 `loop.cjs` 執行下一步。

| BUILD 輸出 | Blueprint Flow 正確行為 |
|-----------|----------------------|
| `NEXT: BUILD --step=N` | ✅ 正確，繼續下一個 Phase |
| `NEXT: SCAN` | ❌ 忽略！重新執行 `loop.cjs` |
| BUILD Phase 8 @PASS | 重新執行 `loop.cjs` |
