---
name: sdid
description: SDID router. Check state → check artifacts → pick mode.
---

# SDID

Blueprint → Draft → Contract → Plan → Build

## STEP 0 — 確認現況

1. `sdid-monitor/hub.json`
2. `.gems/iterations/iter-N/.state.json`
3. `.gems/iterations/iter-N/logs/` 最新一筆
4. `contract_iter-N.ts` · `implementation_plan_*.md` 是否存在

## ROUTE

| 工件狀態 | Mode | Load |
|---|---|---|
| 有 contract + 有 plan | `BUILD-AUTO` | `references/build-execution.md` |
| 有 contract，沒有 plan | `PLAN-WRITE` | `references/plan-writer.md` |
| 有 draft，沒有 contract | `TDD-CONTRACT` | `references/tdd-contract-prompt.md` |
| 有 blueprint，沒有 draft | `BLUEPRINT-CONTINUE` | `references/blueprint-design.md` |
| 什麼都沒有 / 需求不清楚 | `DESIGN-BLUEPRINT` | `references/blueprint-design.md` |
| 只修小 bug | `MICRO-FIX` | `references/micro-fix.md` |
| 重跑某個 phase | `RERUN-PHASE` | task-pipe runner |

背景文件（需要時讀）：`ROADMAP.md` · `ARCHITECTURE.md` · `MEMORY_LAYER.md`

## PENDING
- `references/poc-fix.md`
- flow-review (optional)
- `references/taskpipe-design.md`
- `references/architecture-rules.md`
