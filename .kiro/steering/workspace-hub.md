---
inclusion: always
---

# SDID Workspace 認知快照
**更新**: 2026-04-13 16:19:07 UTC
**Root**: `C:\Users\user\Desktop\SDID`
**Monitor**: http://localhost:3737

## SDID 框架架構
ARCHITECTURE.md —，更新 —

## ROADMAP Milestone
最後更新 —

**完成**: M11 — MODIFY 函式提示：loop.mjs HUB 注入加 ⚠️ evolution=MODIFY 警示 | M12 — iter 函式快照保存：SCAN 後存 functions-snapshot.json 到 iter 目錄供跨 iter diff | M14 — Skill 串接模式研究：研究 Superpowers 等 skill 驅動模式，找出順暢串接的關鍵因素 | M15 — Gate Output Pointer：Gate output 改 pointer（read log）不是 content，@TASK 不塞 context，stub 照抄防護 + gold template 引導 | M18 — AC 簡化/TDD 替代：Contract absorbs Spec，plan-generator 直讀 contract，spec 層消除 | M22 — Terminal State：每個模式加明確 terminal state，解決 HUB 卡住問題 | M24 — Log Output 精簡化：終端機極簡化到 hub→log 就好，統一規範但內容精準化 | M26 — CYNEFIN 提前觸發：Blueprint Round 1 前加輕量 quick-scan，Chaotic domain 提早發現不浪費 5 輪對話 | M25 — Adversarial Reviewer：BUILD 完成後，獨立 subagent 對照 CONTRACT.ts 型別邊界 vs 實作，抓腳本 gate 抓不到的語意飄移 | M17 — GEMS Tags 正確模型：Spec 放完整 tags 防飄移（AI 開發時自然對齊），新增/漏掉的用 AST 找洞 → AI 補 GEMS-FLOW（人看的）+ 頂層行，[STEP] 執行鷹架用完不補 | M23 — Per-step Subagent：每個 step 用獨立 subagent 執行，context 隔離，依複雜度選模型（機械任務用便宜模型） | M16 — 骨架映射強化：程式碼映射 + API 簽名對齊、context window 最小化避免後段壓縮 | M27 — DESIGN 評分拋棄式 Gate：DESIGN 階段（Blueprint→Contract）改為 generation loop，gate 給分 < 80 輸出 @REGEN-HINT 讓 AI 重生成整個 draft，品質問題（TAG/FLOW/ACC/BUDGET）降為 WARN 進 SCORE 機制，不再卡 patch loop | M28 — HARNESS 演進：Contract 黃金樣板（@CONTRACT/@TEST/@RISK/@GEMS-FLOW/Behavior:）+ TDD-first + GEMS 標籤 1 行簡化 + CYNEFIN 改行為數量 gate

## SDID 框架健康

- `sdid-core/` 8 支 | 最後異動: 2026-04-14 | 1 邊 ✅ | 入口: architecture-contract.cjs, home.cjs, orchestrator.cjs, sdid-wrapper.cjs, state-machine.cjs, test-route-skill-enforcement.cjs
- `sdid-monitor/` 8 支 | 最後異動: 2026-04-07 | 2 邊 ✅ | 入口: main.cjs, server.cjs, update-hub.cjs
- `sdid-tools/` 49 支 | 最後異動: 2026-04-13 | 3 邊 ✅ | 入口: plan-to-scaffold.cjs, poc-to-scaffold.cjs, review-proof.cjs, state-guide.cjs, sync-skills.cjs
- `task-pipe/` 87 支 | 最後異動: 2026-04-13 | 16 邊 ✅ | 入口: runner.cjs

## Git
**目前 branch**: `main`

**Worktrees**:
- `main` → C:/Users/user/Desktop/SDID
- `claude/kind-feynman` → C:/Users/user/Desktop/SDID/.claude/worktrees/kind-feynman
- `claude/vibrant-lamport` → C:/Users/user/Desktop/SDID/.claude/worktrees/vibrant-lamport

**最近 commits**:
- 3d9408d feat(sdid): add fixed-entry home wrapper for agents
- d0c5197 chore(repo): ignore local projects and generated assets
- d9021a0 chore(repo): remove retired worktrees and obsolete assets
- da75dff chore(sdid): align plan gates, scan flow, and review tooling
- 0af1b0f chore(repo): remove retired sample projects and archives
- 363b7a9 feat(sdid): add repair-first home wrapper routing
- 2dd2936 feat(sdid): rebuild iter state from scan evidence
- ad67a11 feat(design-review): 新增 UI 位階與架構層分拆規則

## 專案狀態（SDID 管理中）

| Project | Iter | Phase | Badge | Tech |
|---------|------|-------|-------|------|
| 工作流程管理 | iter-15 | DONE | @PASS | — |
| EXAMFORGE | iter-11 | DONE | @PASS | — |

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