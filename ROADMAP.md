# SDID 快速導航
> 自動生成 — 2026-03-16 16:01:34 UTC | 手動更新: `node sdid-monitor/update-hub.cjs`

## 框架路線
ARCHITECTURE.md v6.1

- Blueprint
- Per-iter Draft
- Per-iter Contract
- POC-FIX

## 專案動向

### 訓練資源管理 `@BLOCK`
- iter: iter-4 | phase: GATE
- 下一步: `node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=.gems/design/blueprint.md --target=訓練資源管理`

### ExamForge `@PASS`
- iter: iter-11 | phase: DONE

### my_workflow `@BLOCK`
- iter: iter-4 | phase: BUILD-1
- 下一步: `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=my_workflow --iteration=iter-4`

### test-blueprint-v6 `@PASS`
- iter: iter-1 | phase: DONE

### test-design-scoring `@PASS`
- iter: iter-3 | phase: CONTRACT
- 下一步: `node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/iter-3/contract_iter-3.ts --target=test-design-scoring --iter=3`

_非 SDID 管理: noteforge, OpenSpec-main, sdid-core_

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