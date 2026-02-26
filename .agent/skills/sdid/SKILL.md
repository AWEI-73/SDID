---
name: sdid
description: SDID 統一開發框架 — 從需求設計到程式碼交付的完整流程。觸發詞：「SDID」「藍圖」「blueprint」「新專案」「開發」「build」「繼續」「POC」「Task-Pipe」「快速建」「練習」「小專案」「create project」「new project」「繼續開發」「跑 build」「自動開發」「一鍵開發」「sdid 小修」「quick fix」「改一下」「fix」「小改」「micro fix」。
---

# SDID — 路由器

> **本文件只做路由判斷。進入模式後讀對應 reference，不要在這裡找規則。**

## 路由判斷（進入 skill 後唯一職責）

| 條件 | 模式 | 動作 |
|------|------|------|
| 使用者說「小修」「fix」「改一下」「quick fix」「micro fix」 | MICRO-FIX | 讀 [micro-fix.md](references/micro-fix.md) |
| **客製化/第三方/特化模組開發**（「跑 POC」「原型驗證」「串接」「調整」「第三方」「客製」+ 非標準 CRUD） | **POC-FIX** | 開 POC 資料夾 → 反覆驗證 → 整合清除 → BUILD + 必寫測試 |
| 有專案 + 主藍圖 ACTIVE + 有 [STUB]/[CURRENT] | BLUEPRINT-CONTINUE | 讀 [blueprint-design.md](references/blueprint-design.md) → CONTINUE 段落 |
| 無專案 + 使用者需求模糊 | DESIGN-BLUEPRINT | 讀 [references/blueprint-design.md](references/blueprint-design.md) → 5 輪對話 |
| 無專案 + 使用者需求明確 | DESIGN-TASKPIPE | 執行 `node .agent/skills/sdid/scripts/taskpipe-loop.cjs --new --project=[name]` |
| 有專案但無 draft + 使用者需求模糊 | DESIGN-BLUEPRINT | 讀 [references/blueprint-design.md](references/blueprint-design.md) → 5 輪對話（迭代號自動遞增） |
| 有專案但無 draft + 使用者需求明確 | DESIGN-TASKPIPE | 執行 `node .agent/skills/sdid/scripts/taskpipe-loop.cjs --project=[path]`（進入新迭代） |
| 有 draft，無 plan | BUILD-AUTO | 看 draft 類型自動選路線（見下方） |
| 有 implementation_plan | BUILD-AUTO | 自動偵測路線繼續 BUILD |
| 使用者說「快速建」「練習」「小專案」 | QUICKSTART | 執行 `node .agent/skills/sdid/scripts/taskpipe-loop.cjs --new --project=[name] --type=[type]` |

### Draft 類型自動判斷（BUILD-AUTO 進入時）

```
Enhanced Draft 格式（模組動作表、迭代規劃表）→ Blueprint 路線 → blueprint-loop.cjs
簡單 requirement_draft → Task-Pipe 路線 → taskpipe-loop.cjs
```

### 路線選擇優先問題

新專案且無現有程式碼時，**先問這一個問題**：
> 「UI 版面和操作流程確認了嗎？還是需要先跑出來看看？」

- 未確認 → **Task-Pipe 優先**（POC 先建 UI 骨架讓使用者確認，再進 PLAN/BUILD）
- 已確認 → 依需求模糊度選路線（見路由表）

> ⚠️ 直接走 Blueprint 路線不驗證 UI，版面由 AI 自行決定，跑完才發現不對成本很高。

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

### 通用規則
1. 每完成一步，報告：「目前在 [模式] [步驟 N]，下一步是 [X]」
2. 使用者插入不相關請求時：先完成當前步驟，回報位置，處理完後回到斷點
3. 禁止讀取 `task-pipe/`、`sdid-tools/` 的 *.cjs 原始碼（工具內部與你無關）
4. 禁止對 `src/` 目錄使用全域 grep/search（迷路時的第一反應，會灌爆 context 引發幻覺）
5. 搜尋範圍限制：DESIGN-BLUEPRINT 模式必須限定在當前步驟的 ALLOWED-READ 檔案內；DESIGN-TASKPIPE 和 BUILD-AUTO 模式依腳本 output 指定的檔案操作

### MICRO-FIX 模式

**觸發條件**: 使用者說「小修」「fix」「改一下」「quick fix」「micro fix」等

**Escalation Check** (先判斷，再決定走哪條路):

| 信號 | 判斷 |
|------|------|
| "just", "fix", "改一下", "小改", 單一檔案/函式 | → 直接走 MICRO-FIX |
| 第三方串接、客製化演算法、需要原型驗證的特化功能 | → 升級到 POC-FIX |
| 多個模組、架構調整、新功能、"重構" | → 升級到 SDID 正常流程 |

**MICRO-FIX 執行步驟**:
1. 確認要改什麼（一句話確認，不問多餘問題）
2. 直接修改檔案
3. 執行 gate 驗證：
   ```bash
   node sdid-tools/micro-fix-gate.cjs --changed=<改動的檔案> --target=<project>
   ```
4. `@PASS` → 完成
5. `@BLOCKER` → 根據輸出修復，重跑 gate

**不做的事**: 不寫測試、不跑完整 BUILD、不需要 story/plan

---

### POC-FIX 模式
- 讀 [references/poc-fix.md](references/poc-fix.md) 取得四階段執行規則（SETUP → VERIFY → CONSOLIDATE → BUILD+TEST）
- 適用：第三方串接、客製化演算法、複雜資料處理等特化功能（非標準 CRUD）
- ⚠️ 與 MICRO-FIX 差異：**必寫測試**、不走 spec/plan

### DESIGN-BLUEPRINT 模式
- 讀 [references/blueprint-design.md](references/blueprint-design.md) 取得完整規則
- 第一步必須是問使用者問題，不是讀檔案
- 禁止讀取 src/*、.gems/*（設計階段不需要看程式碼）

### DESIGN-TASKPIPE 模式
- 讀 [references/taskpipe-design.md](references/taskpipe-design.md) 取得 POC-PLAN 規則
- 執行 `node .agent/skills/sdid/scripts/taskpipe-loop.cjs`，按 output 指示操作

### BUILD-AUTO 模式
- 讀 [references/build-execution.md](references/build-execution.md) 取得 BUILD 規則
- 執行對應的 loop script，按 output 指示操作
- 收到 @TASK 時直接修復，不要回讀 plan 或架構文件

### QUICKSTART 模式
- 用一句話確認使用者要建什麼，然後直接執行
- 如果使用者已經描述清楚，跳過確認直接執行

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

| 文件 | 用途 | 何時讀取 |
|------|------|---------|
| [blueprint-design.md](references/blueprint-design.md) | Blueprint 5 輪對話規則 | 進入 DESIGN-BLUEPRINT / BLUEPRINT-CONTINUE 時 |
| [taskpipe-design.md](references/taskpipe-design.md) | POC-PLAN 漸進式規則 | 進入 DESIGN-TASKPIPE 時 |
| [build-execution.md](references/build-execution.md) | BUILD Phase 1-8 + 錯誤處理 | 進入 BUILD-AUTO 時 |
| [micro-fix.md](references/micro-fix.md) | MICRO-FIX 執行規則 | 進入 MICRO-FIX 時 |
| [poc-fix.md](references/poc-fix.md) | POC-FIX 四階段執行規則 | 進入 POC-FIX 模式時 |
| [cynefin-check.md](references/cynefin-check.md) | 進 PLAN 前語意域分析 | 兩條路線進 PLAN 前強制執行 |
| [architecture-rules.md](references/architecture-rules.md) | 模組化架構規則 | Blueprint Round 3 或 PLAN Step 2 時 |
| [action-type-mapping.md](references/action-type-mapping.md) | 動作類型映射 | Blueprint Round 5 或 PLAN Step 4 時 |
| [SDID_ARCHITECTURE.md](references/SDID_ARCHITECTURE.md) | 框架全局說明（給人看，AI 不需每次讀） | 需要框架全貌時 |
