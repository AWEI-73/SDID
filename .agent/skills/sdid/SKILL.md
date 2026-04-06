---
name: sdid
description: >
  觸發：(1) 出現「SDID」「.gems/」「iter-N」「blueprint」「draft」「contract」
  「implementation_plan」「cynefin」「GEMS 標籤」等框架詞彙；
  (2) 開始或繼續結構化開發流程（新專案、新 iter、BUILD 斷點、Phase 重跑）。
  不觸發：純程式問答、無 SDID 脈絡的 bug fix、只討論架構不實作。
---

# SDID

Blueprint → Draft → Contract → Plan → Build → Scan → Verify

## STEP 0 — 確認現況

1. `sdid-monitor/hub.json`
2. `.gems/iterations/` 找最大 iter-N → 確認當前 N
3. `.gems/iterations/iter-N/.state.json`
4. `.gems/iterations/iter-N/logs/` 最新一筆
5. 檢查工件是否存在：`blueprint.md` · `draft_iter-N.md` · `contract_iter-N.ts` · `implementation_plan_*.md`

## ROUTE — 由上到下，第一個符合就停止

| 工件狀態 | Mode | Load |
|---|---|---|
| 有 contract + 有 plan | `BUILD-AUTO` | `references/build-execution.md` |
| 有 contract，沒有 plan | `PLAN-WRITE` → 寫完 plan 進 BUILD-AUTO | `references/plan-writer.md` |
| 有 draft，沒有 contract | `TDD-CONTRACT` → 寫完 contract 進 PLAN-WRITE | `references/tdd-contract-prompt.md` |
| 有 blueprint，沒有 draft | `BLUEPRINT-CONTINUE` | `references/blueprint-design.md` |
| 什麼都沒有 / 需求不清楚 | `DESIGN-BLUEPRINT` | `references/blueprint-design.md` |
| 重跑某個 phase | `RERUN-PHASE` | task-pipe runner |

找到 Mode 後，載入對應 reference 並依照其指示執行。

背景文件（需要時讀）：`ROADMAP.md` · `ARCHITECTURE.md` · `MEMORY_LAYER.md`

## PENDING
- `references/micro-fix.md`
- `references/poc-fix.md`
- flow-review (optional)
- `references/architecture-rules.md`
