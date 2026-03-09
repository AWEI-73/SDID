# SDID 快速導航
> 自動生成 — 2026-03-09 23:28:10 UTC | 手動更新: `node sdid-monitor/update-hub.cjs`

## 框架路線
ARCHITECTURE.md v5.0

**路線 A**: Blueprint Flow（主線）
  → 適用: 需求模糊 / 大型功能
**路線 B**: POC-FIX
  → 適用: 第三方串接 / 特化模組
**路線 C**: MICRO-FIX
  → 適用: 單函式微調 / 快速修復
**路線 D**: Task-Pipe Flow（備用）
  → 適用: 漸進式設計 / 小型專案（備用）

## 專案動向

### 訓練資源管理 `@BLOCK`
- iter: iter-4 | phase: BUILD-8
- 下一步: `node task-pipe/runner.cjs --phase=BUILD --step=8 --target=訓練資源管理`

### ExamForge `@PASS`
- iter: iter-11 | phase: DONE

### my_workflow `@BLOCK`
- iter: iter-4 | phase: BUILD-1
- 下一步: `node task-pipe/runner.cjs --phase=BUILD --step=1 --target=my_workflow`

### test-blueprint-flow
- iter: iter-2 | phase: —

### test-loop-calc `@PASS`
- iter: iter-1 | phase: DONE

### test-taskpipe-flow `@PASS`
- iter: iter-1 | phase: BUILD-5
- 下一步: `node task-pipe/runner.cjs --phase=BUILD --step=6 --target=test-taskpipe-flow`

_非 SDID 管理: bluemouse-main, sdid-core_

## 工具快速參考

```bash
# Blueprint Flow
node sdid-tools/blueprint-gate.cjs --draft=<path> --target=<proj> --iter=N
node sdid-tools/draft-to-plan.cjs  --draft=<path> --iter=N --target=<proj>
node task-pipe/runner.cjs --phase=BUILD --step=N --story=Story-X.Y --target=<proj>
node sdid-tools/blueprint-shrink.cjs --draft=<path> --iter=N --target=<proj>
node sdid-tools/blueprint-verify.cjs --draft=<path> --target=<proj> --iter=N

# POC-FIX / MICRO-FIX
node sdid-tools/micro-fix-gate.cjs --changed=<files> --target=<proj> --iter=N

# 狀態查詢
node sdid-tools/state-guide.cjs --project=<proj>

# Monitor
node sdid-monitor/server.cjs   # http://localhost:3737
node sdid-monitor/update-hub.cjs  # 手動刷新
```