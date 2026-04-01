# SDID 快速導航
> 自動生成 — 2026-04-01 11:07:28 UTC | 手動更新: `node sdid-monitor/update-hub.cjs`

## 框架路線
ARCHITECTURE.md v7.0

- Blueprint
- Per-iter Draft
- Per-iter Contract
- POC-FIX

## 專案動向

### 工作流程管理 `@PASS`
- iter: iter-5 | phase: DONE

### qs-new-app
- iter: iter-1 | phase: —

### SDID `@PASS`
- iter: iter-1 | phase: CONTRACT
- 下一步: `node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/iter-1/contract_iter-1.ts --target=SDID --iter=1`

### train-v2 `@PASS`
- iter: iter-2 | phase: DONE

### train-v3 `@PASS`
- iter: iter-4 | phase: DRAFT_GATE
- 下一步: `node sdid-tools/blueprint/v5/draft-gate.cjs --draft=.gems/design/draft_iter-4.md --target=train-v3`

### train-v4 `@PASS`
- iter: iter-1 | phase: DONE

### training-dashboard `@PASS`
- iter: iter-2 | phase: DONE

### training-resource-mgmt `@PASS`
- iter: iter-1 | phase: DONE

_非 SDID 管理: ExamForge, OpenSpec-main, test-design-scoring, train-dashboard, 訓練資源管理_

## M28 — HARNESS 演進進度
<!-- 此區塊為手動維護，update-hub.cjs 不覆蓋 -->

| ID | 任務 | 狀態 |
|----|------|------|
| M28-1 | tdd-contract-prompt.md 黃金樣板 LOCKED | ✅ done |
| M28-2 | contract-gate.cjs CG-005（Behavior: 錯誤路徑 WARNING） | ⬜ pending |
| M28-3 | phase-2.cjs @TEST 路徑存在性驗證 + it()/test() 確認 | ⬜ pending |
| M28-4 | phase-3.cjs P0 SVC/API 整合測試驗證 | ⬜ pending |
| M28-5 | phase-4.cjs 移除 Fillback/iteration_suggestions，SCAN 注入 flow+testPath | ⬜ pending |
| M28-6 | plan-generator.cjs 第一步改為寫 @TEST 指定測試（RED） | ⬜ pending |
| M28-7 | sdid/SKILL.md 移除 CYNEFIN 語意自預測，保留行為數量 gate | ⬜ pending |
| M28-8 | GEMS Scanner 解析 @GEMS-FLOW 注入 functions.json behavior 欄位 | ⬜ pending |
| M28-9 | 修復 functions.json storyId 空值（SCAN linkage broken） | ⬜ pending |
| M28-10 | contract-golden.template.v4.ts 完整範例（SIMPLE/COMPLEX/HOOK） | ✅ done |

## GEMS 標籤格式（v4 簡化版）
<!-- 此區塊為手動維護，update-hub.cjs 不覆蓋 -->

### 程式碼端（實作檔，1 行）

```typescript
/** GEMS: {Name} | {P0|P1} | {StoryId} | {FLOW} | deps:[{dep1,dep2}] */
```

範例：
```typescript
/** GEMS: CategoryService | P0 | Story-2.0 | GETALL(Clear)→CREATE(Complicated)→UPDATE(Complicated) | deps:[SheetsClient,CoreTypes] */
/** GEMS: useTrainingClasses | P1 | Story-3.2 | INIT(Clear)→FETCH(Complicated)→REFRESH(Complicated) | deps:[apiClient] */
```

### FLOW 規則

| 層級 | FLOW 格式 | 範例 |
|------|----------|------|
| interface/service | method 名稱 | `GETALL(Clear)→CREATE(Complicated)` |
| hook | 狀態轉換名 | `INIT(Clear)→FETCH(Complicated)→REFRESH(Complicated)` |
| 單一函式 | 內部計算步驟 | `PARSE_DATE(Clear)→ADD_OFFSET(Clear)→FORMAT_ISO(Clear)` |

只在 Complicated/Complex 步驟標注括號，Clear 省略括號也可接受。

### 捨棄的欄位

| 欄位 | 原因 |
|------|------|
| GEMS-FLOW（獨立行） | 合併入 1 行 GEMS 標籤 |
| GEMS-DEPS-RISK | 冗餘，由 @RISK 在 contract 端表達 |
| GEMS-WHY goal/guard/fail | 語意層，由 contract Behavior: 取代 |
| @GEMS-VIEW | 裝飾性，改用 @GEMS-HOOK |

## 工具快速參考

```bash
# Blueprint Flow (v6)
node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=.gems/design/blueprint.md --target=<proj>
node sdid-tools/blueprint/v5/draft-gate.cjs --draft=.gems/design/draft_iter-N.md --target=<proj>
node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/iter-N/contract_iter-N.ts --target=<proj> --iter=N
node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=<proj> --iter=N
node task-pipe/tools/spec-to-plan.cjs --target=<proj> --iteration=iter-N
node task-pipe/runner.cjs --phase=BUILD --step=N --story=Story-X.Y --target=<proj> --iteration=iter-N
node task-pipe/runner.cjs --phase=SCAN --target=<proj> --iteration=iter-N
node sdid-tools/blueprint/verify.cjs --draft=.gems/design/draft_iter-N.md --target=<proj> --iter=N

# POC-FIX
node sdid-tools/poc-to-scaffold.cjs --log=<consolidation-log.md> --target=<proj>
node sdid-tools/poc-fix/micro-fix-gate.cjs --target=<proj> --iter=N

# MICRO-FIX
node sdid-tools/poc-fix/micro-fix-gate.cjs --changed=<files> --target=<proj>

# 狀態查詢
node sdid-tools/state-guide.cjs --project=<proj>
node task-pipe/tools/project-status.cjs --target=<proj>

# Monitor
node sdid-monitor/server.cjs   # http://localhost:3737
node sdid-monitor/update-hub.cjs  # 手動刷新
```