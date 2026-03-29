---
name: sdid
description: SDID v7.0 是結構化全端開發框架，涵蓋 Blueprint 5輪需求設計、Draft-Contract 主流程、BUILD Phase 1-4 v7 自動化建置（TDD 驗收）。以下情境必須觸發：(1) 出現「SDID」「sdid-loop」「.gems/」「GEMS 標籤」「GEMS-FLOW」「GEMS-DEPS」「implementation_plan」「iter-N」「cynefin」等框架專有詞彙；(2) 建新專案且需結構化流程（Blueprint/Draft）；(3) 繼續 SDID 專案開發（BUILD 斷點、Phase 重跑、Story 續跑）；(4) 說「小修/micro fix/quick fix」且有明確模組脈絡；(5) 驗證第三方 API 或特化演算法的 POC；(6) 說「快速建/練習專案/小專案」要直接開發。不觸發：純程式問答、無 SDID 脈絡的 bug fix、只討論架構不實作、一般 Docker/CI/CD 操作。
---

# SDID — 路由器

> **本文件只做路由判斷。進入模式後讀對應 reference，不要在這裡找規則。**

## 路由判斷（進入 skill 後唯一職責）

| 條件 | 模式 | 動作 |
|------|------|------|
| 使用者說「小修」「fix」「改一下」「quick fix」「micro fix」 | MICRO-FIX | 讀 [micro-fix.md](references/micro-fix.md) |
| **客製化/第三方/特化模組開發**（「跑 POC」「原型驗證」「串接」「調整」「第三方」「客製」+ 非標準 CRUD） | **POC-FIX** | 開 POC 資料夾 → 反覆驗證 → 整合清除 → BUILD + 必寫測試 |
| 有專案 + 主藍圖 ACTIVE + 有下一個未開始 iter（無對應 draft） | BLUEPRINT-CONTINUE | 讀 [blueprint-design.md](references/blueprint-design.md) → CONTINUE 段落 |
| 無專案 + 使用者需求模糊 | DESIGN-BLUEPRINT | 讀 [references/blueprint-design.md](references/blueprint-design.md) → 5 輪對話 |
| 無專案 + 使用者需求明確 | DESIGN-TASKPIPE | 引導建立 `draft_iter-N.md`，進入主流程 |
| 有專案但無 draft + 使用者需求模糊 | DESIGN-BLUEPRINT | 讀 [references/blueprint-design.md](references/blueprint-design.md) → 5 輪對話（迭代號自動遞增） |
| 有專案但無 draft + 使用者需求明確 | DESIGN-TASKPIPE | 引導建立 `draft_iter-N.md`，進入主流程（新迭代） |
| 有 draft，無 plan | BUILD-AUTO | 看 draft 類型自動選路線（見下方） |
| 有 implementation_plan | BUILD-AUTO | 自動偵測路線繼續 BUILD |
| 使用者說「快速建」「練習」「小專案」 | DESIGN-TASKPIPE | 引導建立 `draft_iter-N.md`，進入主流程 |
| 使用者說「重跑 Phase N」「跑 Phase N」「Phase N 重跑」 | RERUN-PHASE | 呼叫 MCP `sdid-loop` tool，帶 `forceStart` 參數 |

### Draft 類型自動判斷（BUILD-AUTO 進入時）

```
.gems/design/blueprint.md 存在 → design-review skill（Blueprint gate）+ blueprint-gate.cjs → 自動銜接
.gems/design/draft_iter-N.md 存在 → design-review skill（Draft gate）
    ↓ @PASS
CYNEFIN-CHECK（強制）
    ↓ @PASS
flow-review skill（強制）
    ↓ @PASS
TDD Contract Subagent（needsTest:true → 寫 @GEMS-TDD 測試檔 → RED 驗證）
    ↓ READY
design-review skill（Contract gate，最多重試 2 次）
    ↓ @PASS
contract-gate.cjs + @CONTRACT-LOCK
    ↓ @PASS
spec-to-plan → BUILD Phase 1-4
（MCP 可用時：sdid-loop 自動偵測狀態；MCP 不可用時：依序手動執行各步驟指令）
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

## 主流程（唯一路線）

> Blueprint 是可選前置入口，不是獨立路線。需求清楚 → 直接寫 Draft。需求模糊 → 先跑 Blueprint 對話，產出後自動銜接 Draft。
> task-pipe/runner.cjs 是 BUILD 執行引擎，sdid-tools 是 gate 工具，兩者都服務同一條主流程。

```
可選前置（需求模糊時）:
  DESIGN-BLUEPRINT  → 5輪對話         → .gems/design/blueprint.md
  BLUEPRINT-CONTINUE → 補需求描述      → .gems/design/blueprint.md（續跑）
    ↓ blueprint-gate → 自動銜接 Draft

主流程（唯一路線）:
  .gems/design/draft_iter-N.md
    └── design-review skill（Draft gate）
          ↓ @PASS
  CYNEFIN-CHECK（強制）
          ↓ @PASS
  flow-review skill（強制）
          ↓ @PASS
  TDD Contract Subagent（needsTest:true → 寫 @GEMS-TDD 測試檔 → RED 驗證）
          ↓ READY
  contract_iter-N.ts
    └── design-review skill（Contract gate）→ contract-gate.cjs + @CONTRACT-LOCK
          ↓ @PASS
  spec-to-plan → implementation_plan_Story-X.Y.md
          ↓
  BUILD Phase 1-4（task-pipe/runner.cjs）
          ↓ 每個 Story @PASS
  SCAN → functions.json
          ↓
  VERIFY（blueprint-verify.cjs）
          ↓ @PASS
          ├─ 藍圖有下一個 iter → BLUEPRINT-CONTINUE（自動展開下一 iter draft）
          └─ 無更多 iter → 專案完成
```

## CYNEFIN-CHECK + CONTRACT（進 PLAN 前強制執行）

> ⚠️ **不詢問使用者、不等待確認、直接執行。**
> 完整規則在 [cynefin-check.md](references/cynefin-check.md)，此處只提示時機。

```
Draft 完成 → CYNEFIN-CHECK → @PASS
  → flow-review skill（強制）→ @PASS
  → TDD Contract Subagent（needsTest:true → 寫 @GEMS-TDD 測試檔）
  → design-review skill（Contract gate）→ contract-gate.cjs → @PASS → spec-to-plan → BUILD Phase 1-4 → SCAN → VERIFY
```

> 路徑：draft 放 `.gems/design/draft_iter-N.md`，contract 放 `.gems/iterations/iter-N/contract_iter-N.ts`。
> contract.ts 是單一規格來源（source of truth）。draft 的 type 欄位只是路由提示，contract 的 @GEMS-API/@GEMS-CONTRACT 才是最終型別定義。

**四節點說明（缺一不可，依序強制）：**

| 節點 | 工具/技能 | 目的 | log 產物 |
|------|---------|------|---------|
| CYNEFIN-CHECK | `sdid-tools/cynefin-log-writer.cjs` | 語意域分析，展開隱含複雜度 | `cynefin-check-pass-*.log` |
| FLOW-REVIEW | flow-review skill（AI subagent） | 客觀審查 FLOW 設計是否有問題，產出 @GEMS-WHY | `flow-review-pass-*.log` |
| CONTRACT | v5: `sdid-tools/blueprint/v5/contract-gate.cjs` | 從 draft 推導型別邊界，收斂 draft 的模糊 type | `contract-pass-*.log` + `contract_iter-N.ts` |
| PLAN | `task-pipe/tools/spec-to-plan.cjs` | 機械轉換 contract → implementation_plan，骨架注入 contract 型別 | `gate-plan-pass-*.log` |

### 通用規則
1. 每完成一步，報告：「目前在 [模式] [步驟 N]，下一步是 [X]」
2. 使用者插入不相關請求時：先完成當前步驟，回報位置，處理完後回到斷點
3. **Terminal 行為規則**：DESIGN-BLUEPRINT / DESIGN-TASKPIPE / BLUEPRINT-CONTINUE 完成後**自動進入下一階段**（CYNEFIN-CHECK → CONTRACT → BUILD-AUTO），不等待確認；其餘模式完成後**停止並等待使用者下一指令**
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

### BLUEPRINT-CONTINUE 模式
- 讀 [references/blueprint-design.md](references/blueprint-design.md) → CONTINUE 段落
- 觸發條件：主藍圖 ACTIVE + 有下一個未開始 iter（`.gems/design/draft_iter-N.md` 不存在）
- 執行步驟：讀主藍圖 → 找下一個未開始 iter → 補需求描述 + Demo Checkpoint → 產出 Draft → draft-gate 驗證 → 存檔
- **Terminal**: Draft 產出 + gate 通過 → 自動進入 CYNEFIN-CHECK → FLOW-REVIEW → CONTRACT → draft-to-plan → BUILD-AUTO，不等待使用者確認

### POC-FIX 模式
- 讀 [references/poc-fix.md](references/poc-fix.md) 取得四階段執行規則（SETUP → VERIFY → CONSOLIDATE → BUILD+TEST）
- 適用：第三方串接、客製化演算法、複雜資料處理等特化功能（非標準 CRUD）
- ⚠️ 與 MICRO-FIX 差異：**必寫測試**、不走 spec/plan
- **Terminal**: BUILD+TEST `@PASS` → 回報整合結果與測試摘要，停止，等待使用者下一指令

### DESIGN-BLUEPRINT 模式
- 讀 [references/blueprint-design.md](references/blueprint-design.md) 取得完整規則
- 第一步必須是問使用者問題，不是讀檔案
- 禁止讀取 src/*、.gems/*（設計階段不需要看程式碼）
- **Terminal**: 5輪對話完成 + Enhanced Draft 產出 → 自動進入 CYNEFIN-CHECK → FLOW-REVIEW → CONTRACT → draft-to-plan → BUILD-AUTO，不等待使用者確認

### BUILD-AUTO 模式
- 讀 [references/build-execution.md](references/build-execution.md) 取得 BUILD 規則
- **BUILD-AUTO = BUILD Phase 1-4 v7**
  - **MCP 可用時**：透過 MCP `sdid-loop` 自動執行
  - **MCP 不可用時**：直接執行 `node task-pipe/runner.cjs --phase=BUILD --step=N --story=Story-X.Y --target=<project>`
  - ⚠️ 禁止直接 `node sdid-tools/mcp-server/adapters/loop.mjs`，這是 MCP adapter，不是 CLI 工具
- 收到 @TASK 時直接修復，不要回讀 plan 或架構文件
- **TDD 驗收規則**：
  - Phase 2 讀 contract.ts 找 `@GEMS-TDD` 標籤 → vitest --run（有 @GEMS-TDD）或 tsc --noEmit（無 @GEMS-TDD）
  - 測試在 contract 階段就要寫好（真正的 TDD：先測試後實作）
  - Phase 1 骨架是 RED 狀態（測試 failing），Phase 2 修實作讓測試 GREEN
  - 不能動測試檔（測試是規格）
  - DB/UI/外部依賴的 Story 不加 @GEMS-TDD，Phase 2 只跑 tsc --noEmit
  - 舊 @GEMS-AC-* 標籤已 deprecated（v7.0），contract-gate 會輸出 @GUIDED 提示
- **Terminal**: 所有 Phase `@PASS` → 回報完成的 Story 與 Phase 數量，停止，等待使用者下一指令

### DESIGN-TASKPIPE 模式
- 讀 [references/taskpipe-design.md](references/taskpipe-design.md) 取得 POC-PLAN 流程規則
- 適用：需求明確（滿足「需求明確」判斷標準 3 項以上）或使用者說「快速建」「練習」「小專案」
- 如果使用者已描述清楚，跳過確認直接引導建立 `draft_iter-N.md`
- 禁止讀取 `src/*`（設計階段不看程式碼）
- **Terminal**: draft 產出 → 自動進入 CYNEFIN-CHECK → FLOW-REVIEW → CONTRACT → BUILD-AUTO，不等待使用者確認

### RERUN-PHASE 模式
- 使用者要求重跑特定 Phase（如「重跑 Phase 2」「Phase 3 重跑」）
- 呼叫 MCP `sdid-loop` tool，帶 `forceStart` 參數：
  ```
  sdid-loop(project: "<專案路徑>", forceStart: "BUILD-<N>", story: "<Story-X.Y>")
  ```
- 如果使用者沒指定 story/iteration，從 `.gems/iterations/` 和 `project-memory.json` 自動偵測
- 收到 `@BLOCK` + `@TASK` → 按 @TASK 修復 → 重跑同一個 Phase
- **Terminal**: `@PASS` → 回報完成的 Phase/Step，問使用者是否繼續下一步，停止等待回應

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
| [taskpipe-design.md](references/taskpipe-design.md) | Task-Pipe POC-PLAN 流程規則 | 進入 DESIGN-TASKPIPE 時 |
| [build-execution.md](references/build-execution.md) | BUILD Phase 1-4 v7 + 錯誤處理 | 進入 BUILD-AUTO 時 |
| [micro-fix.md](references/micro-fix.md) | MICRO-FIX 執行規則 | 進入 MICRO-FIX 時 |
| [poc-fix.md](references/poc-fix.md) | POC-FIX 四階段執行規則 | 進入 POC-FIX 模式時 |
| [cynefin-check.md](references/cynefin-check.md) | 進 PLAN 前語意域分析（強制執行） | Draft 完成後進 PLAN 前 |
| [architecture-rules.md](references/architecture-rules.md) | 模組化架構規則 | Blueprint Round 3 或 PLAN Step 2 時 |
| [action-type-mapping.md](references/action-type-mapping.md) | 動作類型映射 | Blueprint Round 5 或 PLAN Step 4 時 |
| [tdd-contract-prompt.md](references/tdd-contract-prompt.md) | TDD Contract Subagent prompt（CYNEFIN @PASS 後寫 @GEMS-TDD 測試檔） | CYNEFIN @PASS → CONTRACT 寫入前 |
| [SDID_ARCHITECTURE.md](references/SDID_ARCHITECTURE.md) | 框架全局說明（給人看，AI 不需每次讀） | 需要框架全貌時 |