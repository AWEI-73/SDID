# SDID — Script-Driven Iterative Development

> AI 驗收協議系統 | 核心哲學：**腳本決定，AI 執行。Gate 比記憶重要。**

---

## 什麼是 SDID？

SDID 是一套用腳本驅動的 Gate 機制，把 AI 的隨機輸出約束成可預測的結構化產出。

- AI coding tools 解決「怎麼寫」
- SDID 解決「寫什麼、怎麼驗、寫完了沒」

---

## 核心系統

| 目錄 | 角色 |
|------|------|
| `task-pipe/` | 規格導向引擎 — POC→PLAN→BUILD→SCAN |
| `sdid-tools/` | Vibe 導向引擎 — Blueprint Gate/Shrink/Expand/Verify |
| `sdid-monitor/` | 監控 UI（Electron）— 即時查看 log 與 SCAN 文件 |
| `.agent/skills/sdid/` | AI Skill 統一入口 — Hub 路由 + Mode Lock |

---

## 兩條設計路線

```
路線 A：Blueprint（需求模糊，從大方向收斂）
  5 輪對話 → Enhanced Draft → blueprint-gate → CYNEFIN-CHECK → draft-to-plan
                                                                      ↓
路線 B：Task-Pipe（需求明確，漸進式細部設計）                           ↓
  POC Step 1-5 → CYNEFIN-CHECK → PLAN Step 1-5                       ↓
                                                                      ↓
                                              implementation_plan（匯流點）
                                                                      ↓
                                              BUILD Phase 1-8（共用）
                                                                      ↓
                                          Blueprint: SHRINK → VERIFY
                                          Task-Pipe: SCAN
```

---

## BUILD Phase 說明

| Phase | 名稱 | S | M | L |
|-------|------|---|---|---|
| 1 | 骨架檢查 | ✅ | ✅ | ✅ |
| 2 | GEMS 標籤驗收 | ✅ | ✅ | ✅ |
| 3 | 測試腳本 | — | ✅ | ✅ |
| 4 | Test Gate | — | ✅ | ✅ |
| 5 | TDD 執行 | — | ✅ | ✅ |
| 6 | 整合測試 *(deprecated)* | — | — | ✅ |
| 7 | 整合檢查 | — | ✅ | ✅ |
| 8 | Fillback | ✅ | ✅ | ✅ |

---

## 快速啟動

```bash
# Task-Pipe 新專案
node task-pipe/skills/sdid-loop/scripts/loop.cjs --new --project=my-app

# 繼續現有專案
node task-pipe/skills/sdid-loop/scripts/loop.cjs --project=./my-app

# Blueprint 路線
node .agent/skills/sdid/scripts/blueprint-loop.cjs --project=./my-app

# 監控 UI
node sdid-monitor/server.cjs
```

---

## 專案列表

| 目錄 | 狀態 | 說明 |
|------|------|------|
| `smart-notebook/` | 開發中 | 智能筆記 |
| `smart-assistant/` | 開發中 | 智能助手 |
| `ExamForge/` | 開發中 | 考試工具 |
| `Task-Priority-AI/` | 開發中 | 任務優先級 AI |
| `time-echo/` | 開發中 | 時間記錄 |
| `選股用/` | 開發中 | 選股工具 |
| `simple-app/` | 開發中 | 簡單應用 |
| `sdid-test-app/` | 測試用 | SDID 系統測試 |
| `control-tower/` | 廢棄 | 參考案例 |

---

## 關鍵文件

| 文件 | 用途 |
|------|------|
| `task-pipe/docs/SDID_MASTER_PLAN.md` | 系統架構總覽 v3.0 |
| `task-pipe/docs/STRATEGY_ROADMAP.md` | 戰略藍圖與技術路線 |
| `.agent/skills/sdid/SKILL.md` | AI Skill 路由規則 |
| `sdid-tools/docs/OPERATIONS_MANUAL.md` | Blueprint 工具操作手冊 |
| `task-pipe/docs/cynefin_whitepaper_v7.md` | Cynefin Check 理論基礎 |
