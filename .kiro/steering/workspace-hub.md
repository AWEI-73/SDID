---
inclusion: always
---

# SDID Workspace 認知快照
**更新**: 2026-03-08 14:07:30 UTC
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
- `claude/agitated-saha` → C:/Users/user/Desktop/SDID/.claude/worktrees/agitated-saha
- `claude/agitated-taussig` → C:/Users/user/Desktop/SDID/.claude/worktrees/agitated-taussig
- `claude/determined-beaver` → C:/Users/user/Desktop/SDID/.claude/worktrees/determined-beaver
- `claude/eager-lichterman` → C:/Users/user/Desktop/SDID/.claude/worktrees/eager-lichterman
- `claude/hungry-snyder` → C:/Users/user/Desktop/SDID/.claude/worktrees/hungry-snyder
- `claude/musing-elbakyan` → C:/Users/user/Desktop/SDID/.claude/worktrees/musing-elbakyan
- `claude/quirky-blackburn` → C:/Users/user/Desktop/SDID/.claude/worktrees/quirky-blackburn
- `claude/silly-agnesi` → C:/Users/user/Desktop/SDID/.claude/worktrees/silly-agnesi
- `claude/stoic-black` → C:/Users/user/Desktop/SDID/.claude/worktrees/stoic-black
- `claude/sweet-proskuriakova` → C:/Users/user/Desktop/SDID/.claude/worktrees/sweet-proskuriakova
- `claude/trusting-fermi` → C:/Users/user/Desktop/SDID/.claude/worktrees/trusting-fermi
- `claude/vigilant-heyrovsky` → C:/Users/user/Desktop/SDID/.claude/worktrees/vigilant-heyrovsky

**最近 commits**:
- eba6573 feat(phase-5): 整合 ac-runner — Step 6.2 AC 機械驗收
- 5529917 feat(sdid-tools): ac-runner v1.0 — 純計算函式機械驗收工具
- 0957326 fix(blueprint-verify): Wave 3.3 — 載入 functions.json 後自動補 acIds
- f35e01c fix(phase-7): findNewPages 改用 path-first 判斷 Page 類型
- a8a3a9f fix(framework): Bug1 + Bug2 — functions.json 繼承 + STUB 不再覆蓋 CURRENT
- eab9168 refactor(gate): 拆分 blueprint-gate.cjs 為 lib/gate-checkers + gate-score + gate-report
- 29ef154 feat(gate): v1.4 — FMT-010/011/012 + score 樣式修正 + stub flow 解析 + parser 放寬 heading + 完整 getFixGuidance
- 0a53ad5 feat(gate): 綠地偵測 — 自動找 draft + 無藍圖時輸出 @TASK 引導去 Gem chatbot

## 專案狀態（SDID 管理中）

| Project | Iter | Phase | Badge | Tech |
|---------|------|-------|-------|------|
| 訓練資源管理 | iter-2 | DONE | @PASS | — |
| ExamForge | iter-11 | DONE | @PASS | — |
| my_workflow | iter-4 | BUILD-1 | @BLOCK | — |
| test-blueprint-flow | iter-2 | — | — | — |

**無 .gems（非 SDID 管理）**: sdid-core

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