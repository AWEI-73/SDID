---
inclusion: always
---

# SDID Workspace 認知快照
**更新**: 2026-03-10 00:09:49 UTC
**Root**: `C:\Users\user\Desktop\SDID`
**Monitor**: http://localhost:3737

## SDID 框架架構
ARCHITECTURE.md v5.0，更新 2026-03-04

**四條路線**:
- 路線 A: Blueprint Flow（主線）
- 路線 B: POC-FIX
- 路線 C: MICRO-FIX
- 路線 D: Task-Pipe Flow（備用）

## ROADMAP Milestone
最後更新 —

**待做**: M11 — MODIFY 函式提示：loop.mjs HUB 注入加 ⚠️ evolution=MODIFY 警示 | M12 — iter 函式快照保存：SCAN 後存 functions-snapshot.json 到 iter 目錄供跨 iter diff | M13 — shrink 後 storyId 保留（技術債）

## SDID 框架
這些是框架本身，不是被管理的 project，通常不需要大量掃描：

- `sdid-monitor/`
- `sdid-tools/`
- `task-pipe/`

## Git
**目前 branch**: `main`

**Worktrees**:
- `main` → C:/Users/user/Desktop/SDID
- `claude/agitated-taussig` → C:/Users/user/Desktop/SDID/.claude/worktrees/agitated-taussig
- `claude/festive-knuth` → C:/Users/user/Desktop/SDID/.claude/worktrees/festive-knuth

**最近 commits**:
- 66e5abc fix(mcp): 修正 gems-scanner-v2.cjs 路徑 — data-tools.mjs + dict-sync.cjs 指向 lib/
- f06e4ab docs: consolidate docs to task-pipe/docs/ — move HOW-IT-WORKS + OPERATIONS_MANUAL, update content to v2.1 arch
- 06f98df fix: Wave 6 - update all old path strings to new folder structure
- eb94ef5 fix: 修正 blueprint/ 移動後的 require 路徑 typo + BOM
- 2a2b2ca refactor: Wave 1-5 — sdid-tools 資料夾重構 + MCP adapter 路徑更新 + 廢棄檔案清理
- 1861101 chore: pre-refactor snapshot — Wave 0 rollback point
- a066e46 chore: 同步 workspace-hub/ROADMAP 快照 + loop.cjs/cynefin 修正
- ff87ae5 fix(phase-1+phase-8): 兩個放寬改善

## 專案狀態（SDID 管理中）

| Project | Iter | Phase | Badge | Tech |
|---------|------|-------|-------|------|
| 訓練資源管理 | iter-4 | BUILD-8 | @BLOCK | — |
| ExamForge | iter-11 | DONE | @PASS | — |
| my_workflow | iter-4 | BUILD-1 | @BLOCK | — |
| test-blueprint-flow | iter-2 | — | — | — |
| test-loop-calc | iter-1 | DONE | @PASS | — |
| test-taskpipe-flow | iter-1 | BUILD-5 | @PASS | — |

**無 .gems（非 SDID 管理）**: bluemouse-main, sdid-core

## 關鍵路徑
```
SDID 核心腳本:
  task-pipe/runner.cjs          ← 執行 phase/step
  sdid-core/state-machine.cjs   ← 狀態推斷引擎
  sdid-tools/mcp-server/        ← MCP 入口（sdid-loop 等）
  .agent/skills/sdid/SKILL.md   ← AI skill hub

Project 資料路徑:
  {proj}/.gems/iterations/iter-N/.state.json  ← 執行狀態
  {proj}/.gems/iterations/iter-N/logs/*.log   ← phase log
  {proj}/.gems/project-memory.json            ← 歷史記憶
  {proj}/.gems/docs/functions.json            ← 函式索引
```

## Log 命名規則
```
build-phase-{N}-Story-{X.Y}-{status}-{ts}.log
poc-step-{N}-{status}-{ts}.log
plan-step-{N}-Story-{X.Y}-{status}-{ts}.log
gate-{check|plan|shrink|expand|verify}-{status}-{ts}.log
cynefin-check-{pass|fail}-{ts}.log
scan-scan-{status}-{ts}.log
```

## 規則
- 先讀這個快照，不要直接 Glob 掃整個 SDID root（會 timeout）
- SDID 框架目錄不需要掃，除非被明確要求修改框架
- 用 `/api/projects` 取即時 project 狀態（Monitor 在線時）
- hub.json 有完整 function 資料，此 .md 是摘要