---
name: sdid
description: SDID v6 是結構化全端開發框架，涵蓋 Blueprint 5輪需求設計、Task-Pipe POC-PLAN漸進式開發、BUILD Phase 1-4 v6 自動化建置。以下情境必須觸發：(1) 出現「SDID」「sdid-loop」「.gems/」「GEMS 標籤」「GEMS-FLOW」「GEMS-DEPS」「implementation_plan」「iter-N」「cynefin」等框架專有詞彙；(2) 建新專案且需結構化流程（Blueprint/Task-Pipe）；(3) 繼續 SDID 專案開發（BUILD 斷點、Phase 重跑、Story 續跑）；(4) 說「小修/micro fix/quick fix」且有明確模組脈絡；(5) 驗證第三方 API 或特化演算法的 POC；(6) 說「快速建/練習專案/小專案」要直接開發。不觸發：純程式問答、無 SDID 脈絡的 bug fix、只討論架構不實作、一般 Docker/CI/CD 操作。
---

# SDID — 路由器

> **本文件只做路由判斷。進入模式後讀對應 reference，不要在這裡找規則。**

## 路由判斷（進入 skill 後唯一職責）

| 條件 | 模式 | 動作 |
|------|------|------|
| 使用者說「小修」「fix」「改一下」「quick fix」「micro fix」 | MICRO-FIX | 讀 [micro-fix.md](references/micro-fix.md) |
| **客製化/第三方/特化模組開發**（「跑 POC」「原型驗證」「串接」「調整」「第三方」「客製」+ 非標準 CRUD） | **POC-FIX** | 開 POC 資料夾 → 反覆驗證 → 整合清除 → BUILD + 必寫測試 |
| 無專案 + 使用者需求模糊 | DESIGN-BLUEPRINT | 讀 [references/blueprint-design.md](references/blueprint-design.md) → 5 輪對話 |
| 無專案 + 使用者需求明確 | DESIGN-TASKPIPE | 呼叫 MCP `sdid-loop` tool，`project=[name]`（自動走 Task-Pipe 路線） |
| 有專案但無 draft + 使用者需求模糊 | DESIGN-BLUEPRINT | 讀 [references/blueprint-design.md](references/blueprint-design.md) → 5 輪對話（迭代號自動遞增） |
| 有專案但無 draft + 使用者需求明確 | DESIGN-TASKPIPE | 呼叫 MCP `sdid-loop` tool，`project=[path]`（進入新迭代） |
| 有 draft，無 plan | BUILD-AUTO | 看 draft 類型自動選路線（見下方） |
| 有 implementation_plan | BUILD-AUTO | 自動偵測路線繼續 BUILD |
| 使用者說「快速建」「練習」「小專案」 | QUICKSTART | 呼叫 MCP `sdid-loop` tool，`project=[name]`（自動走 Task-Pipe 路線） |
| 使用者說「重跑 Phase N」「跑 Phase N」「Phase N 重跑」 | RERUN-PHASE | 呼叫 MCP `sdid-loop` tool，帶 `forceStart` 參數 |

### Draft 類型自動判斷（BUILD-AUTO 進入時）

```
blueprint.md 存在（v5）→ Blueprint v5 路線 → sdid-loop 自動走 blueprint-gate → draft-gate → contract-gate
Enhanced Draft 格式（requirement_draft_iter-N.md，v4）→ Blueprint v4 路線 → sdid-loop 自動走 gate.cjs
簡單 requirement_draft → Task-Pipe 路線 → sdid-loop 自動走 POC/PLAN
（sdid-loop 會自動偵測路線，不需要手動選擇腳本）
```

### 路線選擇優先問題

新專案且無現有程式碼時，**先問這一個問題**：
> 「UI 版面和操作流程確認了嗎？還是需要先跑出來看看？」

- 未確認 → **Task-Pipe 優先**（POC 先建 UI 骨架讓使用者確認，再進 PLAN/BUILD）
- 已確認 → 依需求模糊度選路線（見路由表）

> ⚠️ 直接走 Blueprint 路線不驗證 UI，版面由 AI 自行決定，跑完才發現不對成本很高。

### 「需求明確」判斷標準（DESIGN-TASKPIPE 觸發條件）

滿足以下 **3 項以上** 視為需求明確：

| 條件 | 說明 |
|------|------|
| 有明確實體 | 使用者說出了資料名稱（如「訂單」「用戶」「商品」） |
| 有明確操作 | 使用者說出了動作（如「新增」「查詢」「匯出」） |
| 有明確使用者 | 說出了誰會用（如「管理員」「學生」「客服」） |
| 有技術偏好 | 說出了技術棧或限制（如「用 React」「要有 API」） |

不滿足 3 項 → 視為需求模糊 → DESIGN-BLUEPRINT。

### 模糊意圖處理

使用者意圖不明時，問一個問題：
> 「你想從大方向開始設計（我會引導你 5 輪對話收斂需求），還是已經知道要做什麼想直接開始？」

不要問超過一個問題。不要自行讀檔案猜測。

---

## 統一管道（兩條設計路線共用下游）

> Blueprint 和 Task-Pipe 是**設計輸入方式**的選擇，不是兩條獨立管道。
> 路由只決定如何收斂需求；CYNEFIN 之後全部合流。

```
ROUTER（本檔案）
  ├── DESIGN-BLUEPRINT  → 5輪對話     → Enhanced Draft
  └── DESIGN-TASKPIPE   → POC Step 1-5 → requirement_draft
          ↓ (兩路線在此合流)
  ┌─────────────────────────────────────────┐
  │           CYNEFIN-CHECK（強制）          │
  └─────────────────────────────────────────┘
          ↓ Blueprint 路線          ↓ Task-Pipe 路線
     CONTRACT → draft-to-plan    PLAN Step 1-5
          ↓                            ↓
  ┌─────────────────────────────────────────┐
  │         BUILD Phase 1-4 v6（共用）       │
  └─────────────────────────────────────────┘
          ↓ Blueprint              ↓ Task-Pipe
     SHRINK → VERIFY              SCAN
```

## CYNEFIN-CHECK + CONTRACT（進 PLAN 前強制執行）

> ⚠️ **不詢問使用者、不等待確認、直接執行。**
> 完整規則在 [cynefin-check.md](references/cynefin-check.md)，此處只提示時機。

```
Blueprint:  Enhanced Draft 完成 → CYNEFIN-CHECK → @PASS → CONTRACT → @PASS → draft-to-plan → BUILD
Task-Pipe:  POC Step 5 完成    → CYNEFIN-CHECK → @PASS → PLAN Step 1 → BUILD
```

**Blueprint 路線三節點說明（缺一不可）：**

| 節點 | 工具路徑 | 目的 | log 產物 |
|------|---------|------|---------|
| CYNEFIN-CHECK | `sdid-tools/cynefin-log-writer.cjs` | 語意域分析，展開隱含複雜度 | `cynefin-check-pass-*.log` |
| CONTRACT | v5: `sdid-tools/blueprint/v5/contract-gate.cjs`<br>v4: `sdid-tools/blueprint/contract-writer.cjs` | 從 draft 推導型別邊界，收斂 draft 的模糊 type | `contract-pass-*.log` + `contract_iter-N.ts` |
| PLAN | `sdid-tools/blueprint/draft-to-plan.cjs` | 機械轉換 draft → implementation_plan，骨架注入 contract 型別 | `gate-plan-pass-*.log` |

> **v5 識別**：`.gems/iterations/iter-N/poc/blueprint.md` 存在 → 走 v5（contract-gate.cjs）；否則走 v4（contract-writer.cjs）。
> contract.ts 是單一規格來源（source of truth）。draft 的 type 欄位只是路由提示，contract 的 @GEMS-API/@GEMS-CONTRACT 才是最終型別定義。

### 通用規則
1. 每完成一步，報告：「目前在 [模式] [步驟 N]，下一步是 [X]」
2. 使用者插入不相關請求時：先完成當前步驟，回報位置，處理完後回到斷點
3. **Terminal 行為規則**：DESIGN-BLUEPRINT / DESIGN-TASKPIPE 完成後**自動進入下一階段**，不等待確認；其餘模式完成後**停止並等待使用者下一指令**
4. 禁止讀取 `task-pipe/`、`sdid-tools/` 的 *.cjs 原始碼（工具內部與你無關）
5. 禁止對 `src/` 目錄使用全域 grep/search（迷路時的第一反應，會灌爆 context 引發幻覺）
6. 搜尋範圍限制：DESIGN-BLUEPRINT 模式必須限定在當前步驟的 ALLOWED-READ 檔案內；DESIGN-TASKPIPE 和 BUILD-AUTO 模式依腳本 output 指定的檔案操作

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
   node sdid-tools/poc-fix/micro-fix-gate.cjs --changed=<改動的檔案> --target=<project>
   ```
4. `@PASS` → **Terminal**: 回報修改的檔案與變更摘要，停止，等待使用者下一指令
5. `@BLOCKER` → 根據輸出修復，重跑 gate

**不做的事**: 不寫測試、不跑完整 BUILD、不需要 story/plan

---

### POC-FIX 模式
- 讀 [references/poc-fix.md](references/poc-fix.md) 取得四階段執行規則（SETUP → VERIFY → CONSOLIDATE → BUILD+TEST）
- 適用：第三方串接、客製化演算法、複雜資料處理等特化功能（非標準 CRUD）
- ⚠️ 與 MICRO-FIX 差異：**必寫測試**、不走 spec/plan
- **Terminal**: BUILD+TEST `@PASS` → 回報整合結果與測試摘要，停止，等待使用者下一指令

### DESIGN-BLUEPRINT 模式
- 讀 [references/blueprint-design.md](references/blueprint-design.md) 取得完整規則
- 第一步必須是問使用者問題，不是讀檔案
- 禁止讀取 src/*、.gems/*（設計階段不需要看程式碼）
- **Terminal**: 5輪對話完成 + Enhanced Draft 產出 → 自動進入 CYNEFIN-CHECK → CONTRACT → draft-to-plan → BUILD-AUTO，不等待使用者確認

### DESIGN-TASKPIPE 模式
- 讀 [references/taskpipe-design.md](references/taskpipe-design.md) 取得 POC-PLAN 規則
- 呼叫 MCP `sdid-loop` tool（`project=[path]`），按 output 指示操作
- **Terminal**: POC Step 5 完成 → 自動進入 CYNEFIN-CHECK → PLAN → BUILD-AUTO，不等待使用者確認

### BUILD-AUTO 模式
- 讀 [references/build-execution.md](references/build-execution.md) 取得 BUILD 規則
- **BUILD-AUTO = BUILD Phase 1-4 v6**，透過 MCP `sdid-loop` 自動執行
- 收到 @TASK 時直接修復，不要回讀 plan 或架構文件
- **AC 驗收規則**：
  - Phase 2 跑 ac-runner，只跑當前 Story 的 AC（story-scope 過濾）
  - contract.ts 的 `@GEMS-STORY-ITEM` 最後一欄必須填 AC-X.Y，ac-runner 才能正確推導 story 映射
  - 純計算函式 → `@GEMS-AC-FN + MODULE + INPUT + EXPECT`；有依賴 → `@GEMS-AC-SKIP: MOCK`
  - Foundation Story（Story-X.0）通常無 CALC AC，Phase 2 會 SKIP，這是正常的
- **Terminal**: 所有 Phase `@PASS` → 回報完成的 Story 與 Phase 數量，停止，等待使用者下一指令

### QUICKSTART 模式
- 用一句話確認使用者要建什麼，然後直接執行
- 如果使用者已經描述清楚，跳過確認直接執行
- **Terminal**: sdid-loop 所有 Phase `@PASS` → 回報完成的專案名稱、Story 與 Phase 數量，停止，等待使用者下一指令

### RERUN-PHASE 模式
- 使用者要求重跑特定 Phase（如「重跑 Phase 2」「Phase 3 重跑」「跑 BUILD step 2」）
- 呼叫 MCP `sdid-loop` tool，帶 `forceStart` 參數：
  ```
  sdid-loop(project: "<專案路徑>", forceStart: "BUILD-<N>", story: "<Story-X.Y>")
  ```
  例：`sdid-loop(project: "my-app", forceStart: "BUILD-2", story: "Story-1.0")`
- 如果使用者沒指定 story/iteration，從 `.gems/iterations/` 和 `project-memory.json` 自動偵測
- 收到 `@BLOCK` + `@TASK` → 按 @TASK 修復 → 重跑同一個 Phase
- **Terminal**: `@PASS` → 回報完成的 Phase/Step，問使用者是否繼續下一步，停止等待回應

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
| [blueprint-design.md](references/blueprint-design.md) | Blueprint 5 輪對話規則 | 進入 DESIGN-BLUEPRINT 時 |
| [taskpipe-design.md](references/taskpipe-design.md) | POC-PLAN 漸進式規則 | 進入 DESIGN-TASKPIPE 時 |
| [build-execution.md](references/build-execution.md) | BUILD Phase 1-4 v6 + 錯誤處理 | 進入 BUILD-AUTO 時 |

| [micro-fix.md](references/micro-fix.md) | MICRO-FIX 執行規則 | 進入 MICRO-FIX 時 |
| [poc-fix.md](references/poc-fix.md) | POC-FIX 四階段執行規則 | 進入 POC-FIX 模式時 |
| [cynefin-check.md](references/cynefin-check.md) | 進 PLAN 前語意域分析 | 兩條路線進 PLAN 前強制執行 |
| [architecture-rules.md](references/architecture-rules.md) | 模組化架構規則 | Blueprint Round 3 或 PLAN Step 2 時 |
| [action-type-mapping.md](references/action-type-mapping.md) | 動作類型映射 | Blueprint Round 5 或 PLAN Step 4 時 |
| [design-quality-gate.md](references/design-quality-gate.md) | DESIGN 階段語意評分規則 | Blueprint R4/R5、DRAFT 組裝後、CONTRACT 完成後、POC.HTML 完成後 |
| [SDID_ARCHITECTURE.md](references/SDID_ARCHITECTURE.md) | 框架全局說明（給人看，AI 不需每次讀） | 需要框架全貌時 |
