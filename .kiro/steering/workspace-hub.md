---
inclusion: always
---

# SDID Workspace 認知快照
**更新**: 2026-03-04 02:37:24 UTC
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

- `sdid-monitor/`
- `sdid-tools/`
- `task-pipe/`

## Git
**目前 branch**: `main`

**Worktrees**:
- `main` → C:/Users/user/Desktop/SDID
- `claude/agitated-saha` → C:/Users/user/Desktop/SDID/.claude/worktrees/agitated-saha
- `claude/determined-beaver` → C:/Users/user/Desktop/SDID/.claude/worktrees/determined-beaver
- `claude/eager-lichterman` → C:/Users/user/Desktop/SDID/.claude/worktrees/eager-lichterman
- `claude/hungry-snyder` → C:/Users/user/Desktop/SDID/.claude/worktrees/hungry-snyder
- `claude/musing-elbakyan` → C:/Users/user/Desktop/SDID/.claude/worktrees/musing-elbakyan
- `claude/quirky-blackburn` → C:/Users/user/Desktop/SDID/.claude/worktrees/quirky-blackburn
- `claude/silly-agnesi` → C:/Users/user/Desktop/SDID/.claude/worktrees/silly-agnesi
- `claude/stoic-black` → C:/Users/user/Desktop/SDID/.claude/worktrees/stoic-black
- `claude/sweet-proskuriakova` → C:/Users/user/Desktop/SDID/.claude/worktrees/sweet-proskuriakova
- `claude/vigilant-heyrovsky` → C:/Users/user/Desktop/SDID/.claude/worktrees/vigilant-heyrovsky

**最近 commits**:
- d698e3e fix(refs): 清除所有舊 loop script 引用 — 統一指向 MCP sdid-loop
- 2fddba7 fix(loop): build-execution.md 改用 MCP sdid-loop + state-machine 加 POC-FIX 完成判斷
- 95f838f docs: 清理過時文件 + ARCHITECTURE.md v5.0 + workspace-hub ROADMAP 補全
- e532c83 feat(mcp): micro-fix-gate 加 iter 參數 + 新增 sdid-poc-scaffold tool
- 41a3725 feat(poc-fix): micro-fix-gate 加 --iter + log 寫入 + poc-fix.md Phase 4 加 poc-to-scaffold 步驟
- 6fae224 feat(poc-fix): consolidation-parser + poc-to-scaffold — POC-FIX 骨架遷移工具
- 3b6fd58 feat(verify): AC 未標記降為 @WARN — PASS 判定加 acAllTagged 條件
- cdedd20 feat(docs+deps): v3 文件更新 + DEPS 模組推導 resolveDeps()

## 專案狀態（SDID 管理中）

| Project | Iter | Phase | Badge | Tech |
|---------|------|-------|-------|------|
| ExamForge | iter-11 | DONE | @PASS | — |
| my_workflow | iter-4 | BUILD-1 | @BLOCK | — |
| sdid-blueprint-lab | iter-1 | PLAN-1 | @BLOCK | — |
| test-blueprint-flow | iter-1 | DONE | @PASS | — |

**無 .gems（非 SDID 管理）**: ralph-main, sdid-core

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