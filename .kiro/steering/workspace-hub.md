---
inclusion: always
---

# SDID Workspace 認知快照
**更新**: 2026-03-01 08:21:40 UTC
**Root**: `C:\Users\user\Desktop\SDID`
**Monitor**: http://localhost:3737

## ROADMAP 進度
Strategy Roadmap v2.8，最後更新 2026-02-16

| Phase | 狀態 |
|-------|------|
| P0: project-memory 接入 runner.cjs ✅ (2026-02-14 完成) | ✅ |
| P0.5: 輸出對齊強化 ✅ (2026-02-15 完成) | ✅ |
| P0.8: Health Report + Plan Schema (2026-02-15 完成) | ✅ |
| P1: state.json 整合 (2026-02-15 完成) | ✅ |
| P1.5: Plan Protocol — 中間層協定化 (2026-02-15 完成) | ✅ |
| P2: 雙入口互通 — POC Step 1 支援 `--from-draft` (2026-02-15 完成) | ✅ |
| P3: Blueprint Flow 的 loop.cjs 整合 (2026-02-15 完成) | ✅ |
| P4: @GUARD 可配置化 (2026-02-15 完成) | ✅ |

## SDID 框架
這些是框架本身，不是被管理的 project，通常不需要大量掃描：

- `github_project/`
- `sdid-monitor/`
- `sdid-tools/`
- `task-pipe/`

## Git
**目前 branch**: `main`

**Worktrees**:
- `main` → C:/Users/user/Desktop/SDID
- `claude/determined-beaver` → C:/Users/user/Desktop/SDID/.claude/worktrees/determined-beaver
- `claude/eager-lichterman` → C:/Users/user/Desktop/SDID/.claude/worktrees/eager-lichterman
- `claude/hungry-snyder` → C:/Users/user/Desktop/SDID/.claude/worktrees/hungry-snyder
- `claude/musing-elbakyan` → C:/Users/user/Desktop/SDID/.claude/worktrees/musing-elbakyan
- `claude/quirky-blackburn` → C:/Users/user/Desktop/SDID/.claude/worktrees/quirky-blackburn
- `claude/stoic-black` → C:/Users/user/Desktop/SDID/.claude/worktrees/stoic-black
- `claude/sweet-proskuriakova` → C:/Users/user/Desktop/SDID/.claude/worktrees/sweet-proskuriakova
- `claude/vigilant-heyrovsky` → C:/Users/user/Desktop/SDID/.claude/worktrees/vigilant-heyrovsky

**最近 commits**:
- 70b60ab fix(phase-2): filepath-error 和 flow-step-error 補印 @LOG 路徑
- d0a7f20 feat(phase-2): v2.6 整合 gems-scanner-v2 AST 精確定位
- 9094d23 docs(architecture): SDID 系統架構全景 v4.1
- 61ab14b refactor(state-guide): 路線 marker 改為 requirement-draft / requirement-spec
- 4be5485 fix(state-guide): 路線偵測改用入口文件識別
- 4d61c3d feat(state-guide): Wave 2 完成 — AI 進入指令包
- b58df98 feat(dict-sync): Wave 3 完成 — lineRange 同步 + status 只升不降
- 9625bad feat(gems-scanner-v2): AST + 雙格式 + gemsId 連結 + phase-2 routing

## 專案狀態（SDID 管理中）

| Project | Iter | Phase | Badge | Tech |
|---------|------|-------|-------|------|
| 選股用 | iter-6 | — | — | — |
| control-tower | iter-6 | BUILD-5 | @FIX | express, @types/express, @types/jest |
| ExamForge | iter-11 | DONE | @PASS | — |
| my_workflow | iter-4 | BUILD-1 | @BLOCK | — |
| sdid-test-app | iter-2 | BUILD-2 | @FIX | — |
| simple-app | iter-1 | POC-1 | @BLOCK | — |
| smart-assistant | iter-1 | — | — | — |
| smart-notebook | iter-1 | DONE | @PASS | — |
| Task-Priority-AI | iter-3 | — | — | — |
| time-echo | iter-1 | DONE | @PASS | — |

**無 .gems（非 SDID 管理）**: sdid-test-app2

## 關鍵路徑
```
SDID 核心腳本:
  task-pipe/runner.cjs          ← 執行 phase/step
  task-pipe/loop.cjs            ← 狀態導航
  sdid-tools/ralph-loop.cjs     ← Blueprint flow
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