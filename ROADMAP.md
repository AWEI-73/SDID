# SDID 快速導航
> 自動生成 — 2026-04-13 16:19:07 UTC | 手動更新: `node sdid-monitor/update-hub.cjs`

## 框架路線
ARCHITECTURE.md —

- Blueprint Flow（主線）
- POC-FIX
- MICRO-FIX

## 專案動向

### 工作流程管理 `@PASS`
- iter: iter-15 | phase: DONE

### EXAMFORGE `@PASS`
- iter: iter-11 | phase: DONE

## M28 — HARNESS 演進進度

| ID | 任務 | 狀態 |
|----|------|------|
| M28-1 | tdd-contract-prompt.md 黃金樣板 LOCKED（FLOW=method層級 | ✅ done |
| M28-2 | contract-gate.cjs v5.2 — v4 HARNESS CG-001~005 + v3 相容（ | ✅ done |
| M28-3 | phase-2.cjs v7.1 — @TEST 路徑支援 + it()/test() 空殼 BLOCKER  | ✅ done |
| M28-4 | phase-3.cjs P0 SVC/API 整合測試驗證 | ✅ done |
| M28-5 | phase-4.cjs 移除 Fillback/iteration_suggestions | ✅ done |
| M28-6 | plan-generator.cjs v2.1 — v4 Step 0 寫 RED 測試 + parseV4C | ✅ done |
| M28-7 | sdid/SKILL.md 移除 CYNEFIN 語意自預測節點 | ✅ done |
| M28-8 | GEMS Scanner 讀簡化 1 行標籤 + 解析 @GEMS-FLOW 注入 functions.jso | ✅ done |
| M28-9 | 修復 functions.json storyId 空值（SCAN linkage broken） | ✅ done |
| M28-10 | contract-golden.template.v4.ts 完整範例（SIMPLE/COMPLEX/HOOK | ✅ done |

## GEMS 標籤格式（v4 簡化版）

程式碼端（實作檔，1 行）：
```typescript
/** GEMS: {Name} | {P0|P1} | {StoryId} | {FLOW} | deps:[{dep1,dep2}] */
```

FLOW 層級規則：

| 層級 | FLOW 格式 | 範例 |
|------|----------|------|
| interface/service | method 名稱 | `GETALL(Clear)→CREATE(Complicated)` |
| hook | 狀態轉換名 | `INIT(Clear)→FETCH(Complicated)→REFRESH(Complicated)` |
| 單一函式 | 內部計算步驟 | `PARSE_DATE(Clear)→ADD_OFFSET(Clear)→FORMAT_ISO(Clear)` |

捨棄：GEMS-FLOW 獨立行、GEMS-DEPS-RISK、GEMS-WHY、@GEMS-VIEW

## 工具快速參考

```bash
# Blueprint Flow (v6)
node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=.gems/design/blueprint.md --target=<proj>
node sdid-tools/blueprint/v5/draft-gate.cjs --draft=.gems/design/draft_iter-N.md --target=<proj>
node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/iter-N/contract_iter-N.ts --target=<proj> --iter=N
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