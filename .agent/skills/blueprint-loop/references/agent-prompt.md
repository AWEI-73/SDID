# Blueprint Loop Agent - Execution Guide v2.1

## Core Loop

```
1. Execute loop.cjs --project=[path]
2. Read output
   - @PASS → auto-advance to next step
   - @BLOCKER → read error log, fix project files, re-run
3. Repeat until <promise>BLUEPRINT-COMPLETE</promise>
```

## Blueprint Flow Phases

```
GATE → PLAN → BUILD (Phase 1-8 per Story) → SHRINK → [EXPAND → GATE → ...] → VERIFY
```

## ⚠️ BUILD 輸出銜接規則 (重要)

BUILD Phase 1-8 是共用 task-pipe 的 runner.cjs，它的輸出提示是為 Task-Pipe Flow 設計的。
在 Blueprint Flow 中，**忽略 BUILD 輸出的「下一步」指令**，改為：

| BUILD 輸出 | Blueprint Flow 正確行為 |
|-----------|----------------------|
| `下一步: node task-pipe/runner.cjs --phase=BUILD --step=N` | ✅ 正確，繼續下一個 Phase |
| `下一步: node task-pipe/runner.cjs --phase=SCAN` | ❌ 忽略！改為重新執行 `loop.cjs` |
| `@PASS \| BUILD Phase 8` | 不要跑 SCAN，重新執行 `loop.cjs`（它會偵測下一個 Story 或 SHRINK） |

**黃金法則**: 永遠透過 `loop.cjs` 執行下一步，不要直接跑 BUILD 輸出的指令。
Loop 會自動判斷：
- 還有未完成的 Story → 繼續 BUILD Phase 1
- 所有 Story 完成 → SHRINK
- SHRINK 完成 → VERIFY 或 EXPAND

## Output Format

Loop outputs colored status with Story progress:
```
📁 專案: ./my-app
📍 迭代: iter-1
📍 狀態: BUILD Phase 3 Story-1.0 (iter-1)

📊 Story 進度: 1/3
   ✅ Story-1.0: DONE
   🔨 Story-1.1: BUILD Phase 3
   ⏳ Story-1.2: PENDING
```

## SCAN→Blueprint 增量替代

Blueprint Flow 不使用 SCAN 階段。取而代之的是：

| Task-Pipe Flow | Blueprint Flow 對應 |
|---------------|-------------------|
| SCAN (全專案掃描) | SHRINK (收縮藍圖) + VERIFY (驗證一致性) |
| SCAN → 產出 functions.json | SHRINK → 更新藍圖標記 [DONE] |
| SCAN → 產出 system-blueprint.json | VERIFY → 驗證藍圖↔源碼一致性 |
| SCAN → 下一個 iteration | EXPAND → 展開下一個 iter 的 [STUB] |

如果需要增量驗證（不跑完整 SHRINK/VERIFY），可以：
```bash
# 只驗證特定 Story 的標籤
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-1.0 --target=<project>

# 只驗證特定 Story 的測試
node task-pipe/runner.cjs --phase=BUILD --step=5 --story=Story-1.0 --target=<project>
```

## Error Recovery

When loop.cjs or gate tools fail:

1. **Find latest error log**
   ```bash
   dir .gems\iterations\iter-X\logs\gate-*-error-*.log
   dir .gems\iterations\iter-X\logs\build-*-error-*.log
   ```

2. **Find `@ERROR_SPEC` or `@GATE_SPEC` marker** - tells you exactly what to fix

3. **Fix project files** (NOT tool files!)
   - Edit files in `src/`, `.gems/iterations/poc/`, `.gems/iterations/plan/`
   - Never modify `sdid-tools/` or `task-pipe/` directories

4. **Re-run loop.cjs** (不要直接重跑 BUILD 指令)

## Red Lines (Never Cross)

| Forbidden | Reason |
|-----------|--------|
| Modify `sdid-tools/` | Tool code is read-only |
| Modify `task-pipe/` | Tool code is read-only |
| Modify `.gems/iterations/*/logs/` | Log files are immutable records |
| Fake draft artifacts | Draft must reflect real requirements |
| Skip steps | Each step validates previous work |
| Run `--help` | SKILL.md has all info |
| Read `*.cjs` source | Tool internals are irrelevant |
| 直接跑 BUILD 輸出的 SCAN 指令 | Blueprint Flow 用 SHRINK 替代 SCAN |

## Log Reading Rules

All logs merge into `.gems/iterations/iter-X/logs/`:

| Tool | Log prefix | Example |
|------|-----------|---------|
| blueprint-gate | `gate-check-` | `gate-check-error-2026-02-13T04-03-33.log` |
| draft-to-plan | `gate-plan-` | `gate-plan-pass-2026-02-13T04-03-34.log` |
| BUILD Phase 1-8 | `build-phase-` | `build-phase-2-Story-1.0-error-...log` |
| blueprint-shrink | `gate-shrink-` | `gate-shrink-pass-2026-02-13T04-03-35.log` |
| blueprint-expand | `gate-expand-` | `gate-expand-pass-2026-02-13T04-03-35.log` |
| blueprint-verify | `gate-verify-` | `gate-verify-pass-2026-02-13T04-03-36.log` |

## Common Fix Patterns

### Gate Failures (blueprint-gate)
- `FMT-001` → One-line goal too short, expand to ≥10 chars
- `TAG-003` → Flow field empty, add STEP1→STEP2→STEP3
- `EVO-001` → BASE depends on L1, fix dependency direction
- `DAG-001` → iter-2 depends on iter-3, fix iter ordering
- `PH-001` → Has {placeholder}, replace with actual content
- `STS-002` → Draft status is PENDING, change to [x] DONE after completing all clarifications
- `LVL-001` → Module count exceeds Level limit, upgrade Level (S→M or M→L)
- `DEPCON-001` → Module definition has deps but iteration plan deps is empty, sync them
- `DEPCON-002` → Module has deps but all action items say deps=無, annotate specific deps
- `LOAD-001` → Single iter has too many modules, redistribute across iters

### Plan Failures (draft-to-plan)
- No output → Draft missing `[CURRENT]` iter marker
- Missing stories → Check action list in draft

### BUILD Failures (Phase 1-8)
- Phase 1 FAIL → 骨架目錄不存在，建立 src/ 結構
- Phase 2 FAIL → GEMS 標籤缺失或格式不符
  - 標籤必須是 `/** GEMS: funcName | P0 | ... */` 格式
  - 標籤放在函式/class/interface/enum 宣告前
  - 檔案級標籤（一個標籤覆蓋整個檔案）放在檔案最頂部
- Phase 4 FAIL → Test files missing or wrong imports
- Phase 5 FAIL → Test failures, fix source code in `src/`
- Phase 7 FAIL → Integration issues, check exports/routes

### Shrink Failures (blueprint-shrink)
- Missing Fillback → Complete BUILD Phase 8 first
- Missing suggestions → Check `iteration_suggestions_*.json`

## GEMS 標籤格式 (Phase 2 掃描器期望)

掃描器支援兩種放置方式：

### 方式 1: 函式級標籤 (每個函式一個)
```typescript
/**
 * GEMS: createRecipe | P0 | ✓✓ | (recipe)→Recipe | Story-1.0 | 建立食譜
 * GEMS-FLOW: Validate→Store→Return
 * GEMS-DEPS: [Shared.MemoryStore (儲存)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: recipe-service.test.ts
 */
export function createRecipe(recipe: Recipe): Recipe {
```

### 方式 2: 檔案級標籤 (一個標籤覆蓋整個檔案)
```typescript
/**
 * GEMS: CoreTypes | P0 | ○○ | (args)→Result | Story-1.0 | 核心型別定義
 * GEMS-FLOW: DEFINE → FREEZE → EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: core-types.test.ts
 */

export enum UserRole { ... }
export interface User { ... }
```

掃描器會自動識別 `GEMS: CoreTypes` 中的函式名，與 Plan 的函式清單比對。

## Codebase Patterns (Learning Mechanism)

Patterns are stored in `iteration_suggestions_Story-X.Y.json` files:

1. **Read previous suggestions** - `.gems/iterations/iter-X/build/iteration_suggestions_*.json`
2. **Check `technicalHighlights`** - reusable patterns discovered
3. **Check `technicalDebt`** - known issues to avoid
4. **Check `suggestions`** - recommended improvements

**Before starting a new Story:**
```bash
dir .gems\iterations\iter-*\build\iteration_suggestions_*.json
```

Read the most recent one to understand project patterns.

## Quality Requirements

- ALL steps must pass validation before advancing
- Do NOT fake artifacts to pass gates
- Keep changes focused and minimal
- Follow existing code patterns in the project

## Completion Signal

When Shrink passes and all Stories complete:
- Loop reads `iteration_suggestions_*.json` from build directory
- If suggestions exist → auto-generates next iter `requirement_draft`, outputs `@NEXT_ACTION`
- If no suggestions → outputs `<promise>BLUEPRINT-COMPLETE</promise>`

Then ask user if they want to start next iteration.

## Self-Iteration Flow

```
iter-1 COMPLETE
  ↓ (loop reads suggestions)
  ↓ (auto-generates iter-2/poc/requirement_draft_iter-2.md)
  ↓ @NEXT_ACTION: review draft, then Expand + re-run
iter-2: GATE → PLAN → BUILD → SHRINK
  ↓ ...
iter-N: GATE → PLAN → BUILD → SHRINK → VERIFY
  ↓ <promise>BLUEPRINT-COMPLETE</promise>
```

## Multi-Iteration Flow

```
iter-1: GATE → PLAN → BUILD → SHRINK
  ↓ (Expand)
iter-2: GATE → PLAN → BUILD → SHRINK
  ↓ (Expand)
iter-N: GATE → PLAN → BUILD → SHRINK → VERIFY
```

Each iteration focuses on the Stories marked `[CURRENT]` in the draft.
Stub actions from previous iters get expanded via `blueprint-expand.cjs`.
