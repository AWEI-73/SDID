---
inclusion: always
---

# SDID Workspace 認知快照
**更新**: 2026-03-16 16:01:34 UTC
**Root**: `C:\Users\user\Desktop\SDID`
**Monitor**: http://localhost:3737

## SDID 框架架構
ARCHITECTURE.md v6.1，更新 2026-03-16

**路線**:
- Blueprint
- Per-iter Draft
- Per-iter Contract
- POC-FIX

## ROADMAP Milestone
最後更新 —

**完成**: M11 — MODIFY 函式提示：loop.mjs HUB 注入加 ⚠️ evolution=MODIFY 警示 | M12 — iter 函式快照保存：SCAN 後存 functions-snapshot.json 到 iter 目錄供跨 iter diff | M14 — Skill 串接模式研究：研究 Superpowers 等 skill 驅動模式，找出順暢串接的關鍵因素 | M15 — Gate Output Pointer：Gate output 改 pointer（read log）不是 content，@TASK 不塞 context，stub 照抄防護 + gold template 引導 | M18 — AC 簡化/TDD 替代：Contract absorbs Spec，plan-generator 直讀 contract，spec 層消除 | M22 — Terminal State：每個模式加明確 terminal state，解決 HUB 卡住問題 | M24 — Log Output 精簡化：終端機極簡化到 hub→log 就好，統一規範但內容精準化 | M26 — CYNEFIN 提前觸發：Blueprint Round 1 前加輕量 quick-scan，Chaotic domain 提早發現不浪費 5 輪對話 | M25 — Adversarial Reviewer：BUILD 完成後，獨立 subagent 對照 CONTRACT.ts 型別邊界 vs 實作，抓腳本 gate 抓不到的語意飄移 | M17 — GEMS Tags 正確模型：Spec 放完整 tags 防飄移（AI 開發時自然對齊），新增/漏掉的用 AST 找洞 → AI 補 GEMS-FLOW（人看的）+ 頂層行，[STEP] 執行鷹架用完不補 | M23 — Per-step Subagent：每個 step 用獨立 subagent 執行，context 隔離，依複雜度選模型（機械任務用便宜模型） | M16 — 骨架映射強化：程式碼映射 + API 簽名對齊、context window 最小化避免後段壓縮 | M27 — DESIGN 評分拋棄式 Gate：DESIGN 階段（Blueprint→Contract）改為 generation loop，gate 給分 < 80 輸出 @REGEN-HINT 讓 AI 重生成整個 draft，品質問題（TAG/FLOW/ACC/BUDGET）降為 WARN 進 SCORE 機制，不再卡 patch loop

## SDID 框架
這些是框架本身，不是被管理的 project，通常不需要大量掃描：

- `sdid-monitor/`
- `sdid-tools/`
- `task-pipe/`

## Git
**目前 branch**: `main`

**Worktrees**:
- `main` → C:/Users/user/Desktop/SDID
- `claude/peaceful-lamport` → C:/Users/user/Desktop/SDID/.claude/worktrees/peaceful-lamport

**最近 commits**:
- f34124e fix: remove stale PLAN phase references in phase-registry-loader
- 647b0f7 chore(cleanup): remove dead PLAN phases + fix CLI loop v6 alignment
- 7e79125 fix(phase-2): align comments with ac-runner v3.0 vitest architecture
- 177f28a docs(architecture): update v6.1 for ac-runner vitest orchestrator
- c0511c0 feat(ac-runner): upgrade to vitest orchestrator + CYNEFIN action-level analysis
- 5e26718 fix(ac-runner): v2.0 — story-scope 過濾 + 格式異常升級為 ERROR
- 2993f79 chore: pre-v6 snapshot — BUILD 8-phase to 4-layer refactor start
- eb1591e fix(runner): 修正 dry-run 模式的 project-type.cjs 路徑 → lib/shared/

## 專案狀態（SDID 管理中）

| Project | Iter | Phase | Badge | Tech |
|---------|------|-------|-------|------|
| 訓練資源管理 | iter-4 | GATE | @BLOCK | — |
| ExamForge | iter-11 | DONE | @PASS | — |
| my_workflow | iter-4 | BUILD-1 | @BLOCK | — |
| test-blueprint-v6 | iter-1 | DONE | @PASS | — |
| test-design-scoring | iter-3 | CONTRACT | @PASS | — |

**無 .gems（非 SDID 管理）**: noteforge, OpenSpec-main, sdid-core

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
# v6 Blueprint Flow
blueprint-gate-{pass|error}-{ts}.log
draft-gate-{pass|error}-{ts}.log
contract-gate-{pass|error}-{ts}.log
cynefin-check-{pass|fail}-{ts}.log
pocfix-active-{ts}.log
pocfix-pass-{ts}.log
build-phase-{N}-Story-{X.Y}-{status}-{ts}.log
scan-scan-{pass|error}-{ts}.log
gate-verify-{pass|error}-{ts}.log
adversarial-review-{pass|drift}-{ts}.log
# MICRO-FIX（全局，不屬於 iter）
microfix-{pass|error}-{ts}.log  → .gems/logs/
# v5 legacy（向後相容）
gate-{check|plan|shrink|expand|verify}-{status}-{ts}.log
poc-step-{N}-{status}-{ts}.log
plan-step-{N}-Story-{X.Y}-{status}-{ts}.log
```

## 規則
- 先讀這個快照，不要直接 Glob 掃整個 SDID root（會 timeout）
- SDID 框架目錄不需要掃，除非被明確要求修改框架
- 用 `/api/projects` 取即時 project 狀態（Monitor 在線時）
- hub.json 有完整 function 資料，此 .md 是摘要