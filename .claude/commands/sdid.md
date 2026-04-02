---
name: sdid
description: SDID v7.0 是結構化全端開發框架，涵蓋 Blueprint 5輪需求設計、Draft-Contract 主流程、BUILD Phase 1-4 v7 自動化建置（TDD 驗收）。以下情境必須觸發：(1) 出現「SDID」「sdid-loop」「.gems/」「GEMS 標籤」「GEMS-FLOW」「GEMS-DEPS」「implementation_plan」「iter-N」「cynefin」等框架專有詞彙；(2) 建新專案且需結構化流程（Blueprint/Draft）；(3) 繼續 SDID 專案開發（BUILD 斷點、Phase 重跑、Story 續跑）；(4) 說「小修/micro fix/quick fix」且有明確模組脈絡；(5) 驗證第三方 API 或特化演算法的 POC；(6) 說「快速建/練習專案/小專案」要直接開發。不觸發：純程式問答、無 SDID 脈絡的 bug fix、只討論架構不實作、一般 Docker/CI/CD 操作。
---

# SDID — 路由器

> **本文件只做路由判斷。進入模式後讀對應 reference，不要在這裡找規則。**

## STEP 0 — 狀態確認（進入任何模式前必做）

先讀以下檔案，建立現狀認知，再做路由判斷。不要猜。

```
1. .gems/project-memory.json
   → 取得 summary.currentIteration（N）
   → 若檔案不存在：N = 1，視為新專案

2. .gems/iterations/iter-{N}/contract_iter-{N}.ts
   → 存在 → state = HAS_CONTRACT

3. .gems/iterations/iter-{N}/plan/implementation_plan_Story-*.md
   → 存在 → state += HAS_PLAN

4. .gems/design/draft_iter-{N}.md
   → 存在 → state = HAS_DRAFT

5. .gems/design/blueprint.md
   → 存在 → 讀 status 欄位，確認是否 ACTIVE + 下一 iter 未開始
```

讀完後，用一行回報目前狀態，例如：
> 「目前 iter-3，HAS_DRAFT，無 contract，進入路由判斷。」

## 路由決策（依序判斷，第一個符合的條件勝出）

```
1. 說「fix」「小修」「quick fix」「micro fix」「改一下」?
   YES → escalation check → MICRO-FIX 或 POC-FIX
   NO  → 繼續

2. 說「重跑 Phase N」「Phase N 重跑」「跑 Phase N」?
   YES → RERUN-PHASE
   NO  → 繼續

3. 讀 .gems/，判斷現有狀態（state 優先於 intent）:
   → contract_iter-N.ts 存在?
       YES → BUILD-AUTO（plan 存在 → 直接 BUILD；plan 不存在 → 先寫 Plan）
   → draft_iter-N.md 存在?
       YES → BUILD-AUTO（entry: design-review → CYNEFIN-CHECK → CONTRACT → PLAN → BUILD）
   → blueprint.md 存在且 ACTIVE + 下一 iter 無 draft?
       YES → BLUEPRINT-CONTINUE
   → 以上皆否 → 繼續

4. 說「快速建」「練習」「小專案」，或需求明確（≥3 項標準）?
   YES → DESIGN-TASKPIPE
   NO  → DESIGN-BLUEPRINT（或問消歧問題）
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
  CYNEFIN-CHECK（行為數量 gate）
    — action 總數 > 8 → BLOCKER 強制拆 iter
    — keyword 命中（FK/Tree→Flat/外部服務）→ needsTest: true
          ↓ @PASS
  TDD Contract Subagent（黃金樣板 v4）
    — 寫 @TEST 測試檔（RED 狀態）
    — contract 格式：@CONTRACT/@TEST/@RISK/@GEMS-FLOW/Behavior:
    — FLOW = method 層級，Behavior: 每行對應一個 it()
          ↓ READY
  contract-gate.cjs v5.2
    — CG-001: P0 必有 @TEST（BLOCKER）
    — CG-003: @TEST 路徑實際存在（BLOCKER）
    — @CONTRACT-LOCK 注入
          ↓ @PASS
  Plan Writer（讀 contract v4 + blueprint → 產出 v4 plan）
    — 每個 @CONTRACT → 一個 Task
    — Behavior: 每行 → 一個 it() 測試案例
    — 檔案路徑從 blueprint 路由結構圖取
    — 格式：### Task N: + - [ ] Step + 完整程式碼
          ↓
  BUILD Phase 1（驗證 plan 結構 + 指引 agent 照 plan 執行）
  BUILD Phase 2（@TEST 跑 vitest GREEN）
  BUILD Phase 3（tsc --noEmit + barrel export）
  BUILD Phase 4（SCAN → functions.json）
          ↓ 每個 Story @PASS
  VERIFY（blueprint-verify.cjs）
          ↓ @PASS
  BLUEPRINT-BACKFILL（回補 blueprint.md）
    — 迭代規劃表：更新本 iter 狀態為 ✅ DONE
    — 模組 API 摘要：新增本 iter 產出的 API
    — 已知技術債：記錄本 iter 發現但未修的問題
    — 下一個 iter 的「可展示標準」從 iteration_suggestions 取
          ↓ blueprint.md 更新完成
          ├─ 藍圖有下一個 iter → BLUEPRINT-CONTINUE（自動展開下一 iter draft）
          └─ 無更多 iter → 專案完成（blueprint 狀態全 ✅）
```

## CYNEFIN-CHECK + CONTRACT（進 PLAN 前強制執行）

> ⚠️ **不詢問使用者、不等待確認、直接執行。**
> 完整規則在 [cynefin-check.md](references/cynefin-check.md)，此處只提示時機。

```
Draft 完成 → CYNEFIN-CHECK（行為數量 gate）→ @PASS
  → TDD Contract Subagent（寫 @TEST 黃金樣板 v4）→ READY
  → contract-gate.cjs v5.2 → @PASS → Plan Writer → BUILD Phase 1-4 → SCAN → VERIFY
```

> 路徑：draft 放 `.gems/design/draft_iter-N.md`，contract 放 `.gems/iterations/iter-N/contract_iter-N.ts`。
> contract.ts 是單一規格來源（source of truth）。格式：@CONTRACT/@TEST/@RISK/@GEMS-FLOW/Behavior:。

**三節點說明（缺一不可，依序強制）：**

| 節點 | 工具/技能 | 目的 | log 產物 |
|------|---------|------|---------|
| CYNEFIN-CHECK | `sdid-tools/cynefin-log-writer.cjs` | **行為數量 gate**（>8 BLOCKER）+ keyword → needsTest | `cynefin-check-pass-*.log` |
| CONTRACT | TDD Contract Subagent + `contract-gate.cjs v5.2` | 黃金樣板 v4 + @TEST RED 存在性驗證 + @CONTRACT-LOCK | `contract-gate-pass-*.log` + `contract_iter-N.ts` |
| PLAN | Plan Writer skill（讀 contract v4 + blueprint） | v4 plan：每個 @CONTRACT → Task，Behavior: → it()，完整程式碼 | `implementation_plan_Story-X.Y.md` |

> **已移除**：FLOW-REVIEW 獨立節點（AI 語意自預測，不可靠）。FLOW 由 TDD Contract Subagent 在撰寫 Behavior: 時一併確認，method 層級 FLOW 寫入 @GEMS-FLOW。

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
- **前置確認**：blueprint.md 的上一個 iter 狀態是否已標 ✅ DONE + 技術債已記錄 → 若未回補先補
- 執行步驟：讀主藍圖 → 找下一個未開始 iter → 補需求描述 + Demo Checkpoint → 產出 Draft → draft-gate 驗證 → 存檔
- **Terminal**: Draft 產出 + gate 通過 → 自動進入 CYNEFIN-CHECK → CONTRACT → draft-to-plan → BUILD-AUTO，不等待使用者確認

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

### BUILD-AUTO 模式
- 讀 [references/build-execution.md](references/build-execution.md) 取得 BUILD 規則
- **BUILD-AUTO = Plan 執行層 + Gate 驗證層**

  **⚠️ 前置檢查（必做）：**
  - 確認 `.gems/iterations/iter-N/plan/implementation_plan_Story-X.Y.md` 存在
  - **不存在 → STOP，先照 [references/plan-writer.md](references/plan-writer.md) 寫 Plan，再進 BUILD**
  - 不可跳過 Plan 直接寫程式碼，Build Phase 1 也會 BLOCKER

  **Plan 執行層（agent 主導）：**
  1. 讀 v4 plan（`implementation_plan_Story-X.Y.md`）
  2. 對每個 Task，依序執行 Step 1-5（寫測試 → RED → 寫實作 → GREEN → commit）
  3. Step 2（RED）和 Step 4（GREEN）必須實際跑，不能跳過
  4. 實作裡加 GEMS 一行標籤 + `[STEP]` 標記

  **Gate 驗證層（cjs 腳本）：**
  ```bash
  node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=<project> --iteration=iter-N
  node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=<project> --iteration=iter-N
  node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y --target=<project> --iteration=iter-N
  node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y --target=<project> --iteration=iter-N
  ```

- 收到 @TASK 時直接修復，不要回讀 plan 或架構文件
- 測試 FAIL 時修實作，不能動測試檔（測試是規格）
- **Terminal**: 所有 Phase `@PASS` → 回報完成的 Story 與 Phase 數量，停止，等待使用者下一指令

### DESIGN-TASKPIPE 模式
- 讀 [references/taskpipe-design.md](references/taskpipe-design.md) 取得 POC-PLAN 流程規則
- 適用：需求明確（滿足「需求明確」判斷標準 3 項以上）或使用者說「快速建」「練習」「小專案」
- 如果使用者已描述清楚，跳過確認直接引導建立 `draft_iter-N.md`
- 禁止讀取 `src/*`（設計階段不看程式碼）
- **Terminal**: draft 產出 → 自動進入 CYNEFIN-CHECK → CONTRACT → BUILD-AUTO，不等待使用者確認

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
| [cynefin-check.md](references/cynefin-check.md) | 行為數量 gate（>8 BLOCKER）+ keyword → needsTest | Draft 完成後進 PLAN 前 |
| [architecture-rules.md](references/architecture-rules.md) | 模組化架構規則 | Blueprint Round 3 或 PLAN Step 2 時 |
| [action-type-mapping.md](references/action-type-mapping.md) | 動作類型映射 | Blueprint Round 5 或 PLAN Step 4 時 |
| [tdd-contract-prompt.md](references/tdd-contract-prompt.md) | TDD Contract Subagent prompt（CYNEFIN @PASS 後寫 @TEST 黃金樣板 v4） | CYNEFIN @PASS → contract-gate 前 |
| [plan-writer.md](references/plan-writer.md) | Plan Writer — contract v4 → v4 plan（### Task N: + 完整程式碼） | contract-gate @PASS 後 |
| [contract-golden-template.md](references/contract-golden-template.md) | Contract 黃金樣板完整參考（@CONTRACT/@TEST/@RISK/@GEMS-FLOW/Behavior:） | 撰寫 contract 時參考 |
| [SDID_ARCHITECTURE.md](references/SDID_ARCHITECTURE.md) | 框架全局說明（給人看，AI 不需每次讀） | 需要框架全貌時 |