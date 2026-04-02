---
name: sdid
description: SDID v7.0 是結構化全端開發框架，涵蓋 Blueprint 5輪需求設計、Draft-Contract 主流程、BUILD Phase 1-4 v7 自動化建置（TDD 驗收）。以下情境必須觸發：(1) 出現「SDID」「sdid-loop」「.gems/」「GEMS 標籤」「GEMS-FLOW」「GEMS-DEPS」「implementation_plan」「iter-N」「cynefin」等框架專有詞彙；(2) 建新專案且需結構化流程（Blueprint/Draft）；(3) 繼續 SDID 專案開發（BUILD 斷點、Phase 重跑、Story 續跑）；(4) 說「小修/micro fix/quick fix」且有明確模組脈絡；(5) 驗證第三方 API 或特化演算法的 POC；(6) 說「快速建/練習專案/小專案」要直接開發。不觸發：純程式問答、無 SDID 脈絡的 bug fix、只討論架構不實作、一般 Docker/CI/CD 操作。
---

# SDID — 路由器

> **本文件只做路由判斷。進入模式後讀對應 reference，不要在這裡找規則。**

---

## Artifacts（四個產物，依序產生，不可跳過）

| 產物 | 路徑 | 定義 | 誰產生 |
|------|------|------|--------|
| **Draft** | `.gems/design/draft_iter-N.md` | **需求**：這個 iter 要做什麼（action 清單） | 設計模式 |
| **Contract** | `.gems/iterations/iter-N/contract_iter-N.ts` | **規格**：每個 action 怎麼測 | TDD Contract Subagent |
| **Plan** | `.gems/iterations/iter-N/plan/implementation_plan_Story-X.Y.md` | **步驟**：每個 @CONTRACT → Task，含完整程式碼 | Plan Writer |
| **Build** | `src/` | **實作**：照 Plan 逐 Task 寫，測試先 RED 再 GREEN | BUILD-AUTO |

**Contract 欄位說明（唯一規格來源）：**
```
@CONTRACT  = 一個可測的行為（P0/P1/P2 優先級）
@TEST      = 測試檔路徑（必須實際存在，RED 狀態）
@GEMS-FLOW = method 層級資料流（Read/Write/Compute/Orchestrate）不是內部步驟
Behavior:  = 每一行對應 Plan 裡的一個 it() 測試案例
```

---

## STEP 0 — 狀態確認（進入任何模式前必做）

先讀以下檔案，建立現狀認知，再做路由判斷。不要猜。

```
1. .task-pipe/state.json
   → 取得最近有 firstRunAt 的 key（格式：PHASE-step-N-Story-X.Y）
   → 得知目前卡在哪個 phase/step/story
   → 若不存在：視為全新開始

2. .gems/project-memory.json
   → 取得 summary.currentIteration（N）、summary.lastPhase、summary.lastStory
   → 若不存在：N = 1，視為新專案

3. .gems/iterations/iter-{N}/contract_iter-{N}.ts    → 存在 → HAS_CONTRACT
4. .gems/iterations/iter-{N}/plan/implementation_plan_Story-*.md  → 存在 → HAS_PLAN
5. .gems/design/draft_iter-{N}.md                    → 存在 → HAS_DRAFT
6. .gems/design/blueprint.md                         → 存在 → 讀 status 欄位
```

讀完後用一行回報，例如：
> 「目前 iter-3，BUILD-phase-2-Story-1.0 中斷，HAS_CONTRACT + HAS_PLAN，進入路由判斷。」

---

## 路由決策（依序判斷，第一個符合的條件勝出）

```
1. 說「fix」「小修」「quick fix」「micro fix」「改一下」?
   YES → escalation check → MICRO-FIX 或 POC-FIX
   NO  → 繼續

2. 說「重跑 Phase N」「Phase N 重跑」「跑 Phase N」?
   YES → RERUN-PHASE
   NO  → 繼續

3. 以 STEP 0 狀態為準:
   HAS_CONTRACT + HAS_PLAN → BUILD-AUTO（直接進 BUILD）
   HAS_CONTRACT，無 plan   → 讀 plan-writer.md → 寫 Plan → BUILD-AUTO
   HAS_DRAFT，無 contract  → design-review → CYNEFIN-CHECK → CONTRACT → 回到上一行
   blueprint ACTIVE + 下一 iter 無 draft → BLUEPRINT-CONTINUE
   以上皆否 → 繼續

4. 說「快速建」「練習」「小專案」，或需求明確（≥3 項）?
   YES → DESIGN-TASKPIPE
   NO  → DESIGN-BLUEPRINT（或問消歧問題）
```

**需求明確判斷（≥3 項）：** 有明確實體、有明確操作、有明確使用者、有技術偏好

---

## 主流程（唯一路線）

```
[可選前置]
  DESIGN-BLUEPRINT / DESIGN-TASKPIPE / BLUEPRINT-CONTINUE → 產出 draft_iter-N.md

主流程:
  draft_iter-N.md
    → design-review skill（Draft gate）
          ↓ @PASS
    → CYNEFIN-CHECK（>8 actions → BLOCKER；keyword 命中 → needsTest:true）
          ↓ @PASS
    → TDD Contract Subagent（讀 tdd-contract-prompt.md）
        職責：寫 contract_iter-N.ts。不寫 plan，不寫實作。
        產出：@CONTRACT + @TEST(RED) + @GEMS-FLOW + Behavior:
        RED 定義：
          ✅ 合格 RED = import fail、函式不存在、模組缺失 → 測試跑起來但因實作不存在而 fail
          ❌ 不合格 = 測試本身語法錯誤、型別錯、測試條件太鬆（永遠會過）
          規則：確認 RED 後不動 production code，留給 BUILD 寫實作
          ↓
    → contract-gate.cjs v5.2（@TEST 存在性 + RED 確認 + @CONTRACT-LOCK）
          ↓ @PASS
    → Plan Writer（讀 plan-writer.md）
        職責：把 contract.ts 翻譯成 implementation_plan。不寫實作。
        規則：每個 @CONTRACT → 一個 Task；每個 Behavior: → 一個 it()
          ↓
    → BUILD Phase 1-4
        職責：照 plan 逐 Task 實作。測試 FAIL → 修實作，不動測試檔。
          ↓ 每個 Story @PASS
    → VERIFY → BLUEPRINT-BACKFILL
          ↓
        有下一 iter → BLUEPRINT-CONTINUE
        無更多 iter → 專案完成
```

---

## 通用規則

1. 每完成一步回報：「目前在 [模式] [步驟 N]，下一步是 [X]」
2. **Terminal 行為**：DESIGN-*/BLUEPRINT-CONTINUE 完成後自動進下一階段，不等待；其餘模式完成後停止等待指令
3. 禁止讀 `task-pipe/`、`sdid-tools/` 的 *.cjs 原始碼
4. 禁止對 `src/` 全域 grep/search
5. DESIGN 模式禁止讀 `src/*`

---

## 模式速查

| 模式 | 觸發條件 | Reference |
|------|----------|-----------|
| MICRO-FIX | 小修/fix/改一下（單一檔案/函式） | [micro-fix.md](references/micro-fix.md) |
| POC-FIX | 第三方串接/客製演算法/需原型驗證 | [poc-fix.md](references/poc-fix.md) |
| DESIGN-BLUEPRINT | 需求模糊/新專案無方向 | [blueprint-design.md](references/blueprint-design.md) |
| DESIGN-TASKPIPE | 需求明確/快速建/練習專案 | [taskpipe-design.md](references/taskpipe-design.md) |
| BLUEPRINT-CONTINUE | 有藍圖 + 下一 iter 無 draft | [blueprint-design.md](references/blueprint-design.md) → CONTINUE |
| BUILD-AUTO | HAS_DRAFT / HAS_CONTRACT / HAS_PLAN | [build-execution.md](references/build-execution.md) |
| RERUN-PHASE | 重跑 Phase N | sdid-loop MCP，帶 forceStart 參數 |

---

## 參考文件

| 文件 | 何時讀取 |
|------|---------|
| [blueprint-design.md](references/blueprint-design.md) | DESIGN-BLUEPRINT / BLUEPRINT-CONTINUE |
| [taskpipe-design.md](references/taskpipe-design.md) | DESIGN-TASKPIPE |
| [cynefin-check.md](references/cynefin-check.md) | Draft @PASS 後，進 contract 前 |
| [tdd-contract-prompt.md](references/tdd-contract-prompt.md) | CYNEFIN @PASS 後 |
| [contract-golden-template.md](references/contract-golden-template.md) | 撰寫 contract 時參考格式 |
| [plan-writer.md](references/plan-writer.md) | contract-gate @PASS 後 |
| [build-execution.md](references/build-execution.md) | 進入 BUILD-AUTO 時 |
| [micro-fix.md](references/micro-fix.md) | MICRO-FIX 模式 |
| [poc-fix.md](references/poc-fix.md) | POC-FIX 模式 |
| [architecture-rules.md](references/architecture-rules.md) | Blueprint Round 3 或 PLAN Step 2 |
| [SDID_ARCHITECTURE.md](references/SDID_ARCHITECTURE.md) | 需要框架全貌時（給人看） |
