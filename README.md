# SDID — AI 協作開發框架

SDID (Structured Iterative Development) 是一套 AI 協作開發框架，讓 AI 從需求設計到程式碼交付走完整個流程。

## 框架結構

```
sdid/
├── task-pipe/          # Task-Pipe 引擎 — POC→PLAN→BUILD→SCAN 流程
├── sdid-tools/         # Blueprint 工具 — 大藍圖設計 (gate/shrink/expand/verify)
├── sdid-monitor/       # 監控 UI — 即時觀察流程狀態
├── .agent/skills/sdid/ # SDID Skill 入口 — AI 路由與模式鎖定
└── .kiro/steering/     # 規則文件 — AI 行為約束
```

## 兩條設計路線

| 路線 | 適合場景 | 入口 |
|------|---------|------|
| Blueprint | 需求模糊，從大方向收斂 | 5 輪對話 → Enhanced Draft → BUILD |
| Task-Pipe | 需求明確，漸進式細部設計 | POC Step 1-5 → PLAN → BUILD |

兩條路線在 `implementation_plan` 匯流，共用 BUILD Phase 1-8。

## 快速開始

```bash
# Task-Pipe 新專案
node task-pipe/skills/sdid-loop/scripts/loop.cjs --new --project=my-app

# 繼續現有專案
node task-pipe/skills/sdid-loop/scripts/loop.cjs --project=./my-app

# Blueprint 路線
node .agent/skills/sdid/scripts/blueprint-loop.cjs --project=./my-app

# 啟動監控 UI
node sdid-monitor/server.cjs
```

## 文件

- `task-pipe/README.md` — Task-Pipe 完整指南
- `task-pipe/docs/SDID_MASTER_PLAN.md` — 系統架構總覽
- `.agent/skills/sdid/SKILL.md` — AI Skill 使用說明
- `sdid-tools/docs/OPERATIONS_MANUAL.md` — Blueprint 工具操作手冊
