# SDID 快速導航
> 自動生成 — 2026-04-01 09:44:47 UTC | 手動更新: `node sdid-monitor/update-hub.cjs`

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