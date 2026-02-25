---
name: sdid
description: SDID 統一開發框架 — 從需求設計到程式碼交付的完整流程。觸發詞：「SDID」「藍圖」「blueprint」「新專案」「開發」「build」「繼續」「POC」「Task-Pipe」「快速建」「練習」「小專案」「create project」「new project」「繼續開發」「跑 build」「自動開發」「一鍵開發」「sdid 小修」「quick fix」「改一下」「fix」「小改」「micro fix」。
---

# SDID — 路由器

> **本文件只做路由判斷。進入模式後讀對應 reference，不要在這裡找規則。**

## 路由判斷（進入 skill 後唯一職責）

| 條件 | 模式 | 動作 |
|------|------|------|
| 使用者說「小修」「fix」「改一下」 | MICRO-FIX | 讀 [micro-fix.md](references/micro-fix.md) |
| 有專案 + 主藍圖 ACTIVE + 有 [STUB]/[CURRENT] | BLUEPRINT-CONTINUE | 讀 [blueprint-design.md](references/blueprint-design.md) → CONTINUE 段落 |
| 無專案 + 需求模糊 | DESIGN-BLUEPRINT | 讀 [blueprint-design.md](references/blueprint-design.md) → 5 輪對話 |
| 無專案 + 需求明確 | DESIGN-TASKPIPE | 讀 [taskpipe-design.md](references/taskpipe-design.md) |
| 有專案 + 無 draft + 需求模糊 | DESIGN-BLUEPRINT | 讀 [blueprint-design.md](references/blueprint-design.md) |
| 有專案 + 無 draft + 需求明確 | DESIGN-TASKPIPE | 讀 [taskpipe-design.md](references/taskpipe-design.md) |
| 有 draft，無 plan | BUILD-AUTO | 讀 [build-execution.md](references/build-execution.md) |
| 有 implementation_plan | BUILD-AUTO | 讀 [build-execution.md](references/build-execution.md) |
| 使用者說「快速建」「練習」 | QUICKSTART | 執行 `node .agent/skills/sdid/scripts/taskpipe-loop.cjs --new --project=[name] --type=[type]` |

### Draft 類型自動判斷（BUILD-AUTO 進入時）

```
Enhanced Draft 格式（模組動作表、迭代規劃表）→ Blueprint 路線 → blueprint-loop.cjs
簡單 requirement_draft → Task-Pipe 路線 → taskpipe-loop.cjs
```

### 模糊意圖處理

使用者意圖不明時，問一個問題：
> 「你想從大方向開始設計（我會引導你 5 輪對話收斂需求），還是已經知道要做什麼想直接開始？」

不要問超過一個問題。不要自行讀檔案猜測。

---

## CYNEFIN-CHECK（進 PLAN 前強制執行）

> ⚠️ **不詢問使用者、不等待確認、直接執行。**
> 完整規則在 [cynefin-check.md](references/cynefin-check.md)，此處只提示時機。

```
Blueprint:  Enhanced Draft 完成 → CYNEFIN-CHECK → @PASS → draft-to-plan → BUILD
Task-Pipe:  POC Step 5 完成    → CYNEFIN-CHECK → @PASS → PLAN Step 1 → BUILD
```

---

## 全授權模式

使用者說「全部授權」「自己跑」「你決定」→ 不問使用者，自主執行。
各模式的全授權差異在各自的 reference 內說明。

---

## 禁止事項

| 禁止 | 原因 |
|------|------|
| 讀 *.cjs 原始碼 | 工具內部與你無關 |
| 對 src/ 全域 grep | 灌爆 context 引發幻覺 |
| 跳過設計步驟 | 每步建立在前一步之上 |
| 猜測需求 | 標記 [NEEDS CLARIFICATION] |
| 在 DESIGN 模式讀 src/ | 設計階段不看程式碼 |

## 參考文件

| 文件 | 何時讀取 |
|------|---------|
| [blueprint-design.md](references/blueprint-design.md) | DESIGN-BLUEPRINT / CONTINUE |
| [taskpipe-design.md](references/taskpipe-design.md) | DESIGN-TASKPIPE |
| [build-execution.md](references/build-execution.md) | BUILD-AUTO |
| [micro-fix.md](references/micro-fix.md) | MICRO-FIX |
| [cynefin-check.md](references/cynefin-check.md) | 進 PLAN 前 |
| [architecture-rules.md](references/architecture-rules.md) | Blueprint Round 3 / PLAN Step 2 |
| [action-type-mapping.md](references/action-type-mapping.md) | Blueprint Round 5 / PLAN Step 4 |
| [SDID_ARCHITECTURE.md](references/SDID_ARCHITECTURE.md) | 框架全局說明（給人看，AI 不需每次讀） |
