# Draft iter-{N}: {模組名稱}

**迭代**: iter-{N}
**模組**: {moduleName}
**目標**: {一行描述此 iter 要達成什麼}
**依賴**: {前置 iter 或模組，例如 shared (iter-1)}

<!--
  Per-iter Draft v5 — 單一迭代的業務語意規格

  職責：動作清單 + TDD 測試需求標記（人的語言）
  不含：實體定義、路由結構、迭代規劃表（這些在 Blueprint）

  產出時機：AI 讀 Blueprint 迭代規劃表 + 前 iter contract 介面後逐個產出
  輸入：Blueprint + 前 iter contract（介面邊界）
  輸出：此檔案 → draft-gate → CYNEFIN-CHECK → TDD Contract Subagent → contract_iter-N.ts
  
  @CONTEXT_SCOPE:
    READ: blueprint.md, contract_iter-{N-1}.ts (介面參考)
    SKIP: 其他 iter 的 draft, 其他 iter 的 contract 內容
-->

---

<!--
  ## 背景（選填，QUALITY/FIX iter 建議補）
  說明前 iter 完成狀況與本 iter 的動機。
  例如：iter-9 完成後，REVIEW 顯示 Service layer 缺乏測試覆蓋，本 iter 補齊。
-->

<!--
  ## 技術約束（選填，有平台限制時補）
  - 測試框架：{vitest / jest / 其他}
  - 測試路徑：{src/modules/**/__tests__/*.test.ts}
  - 特殊限制：{例如 GAS 環境不能直接跑 vitest，需 mock runtime}
  - 現有測試不能破壞（目前 N 個測試）
-->

## Story 拆法

> {說明此 iter 的 Story 怎麼拆，例如: Story-0 後端服務, Story-1 前端串接}

## 動作清單

| 描述 | 類型 | 技術名 | 簽名 | 優先級 | 流向 | 依賴 | TDD |
|------|------|--------|------|--------|------|------|-----|
| {業務描述} | {SVC/UI/ROUTE/TEST/CALC/CONST/CREATE/READ/MODIFY/DELETE} | {functionName} | ({param}: {Type}) → {ReturnType} | P{0-3} | {STEP1→STEP2→RETURN} | [{dep}] | [{TAG}] |

<!--
  類型對照:
    SVC = 服務函式    UI = 前端元件      ROUTE = 路由/頁面
    CALC = 計算邏輯   CONST = 常數/型別   CREATE/READ/MODIFY/DELETE = CRUD
    TEST = 測試補充 iter（補齊覆蓋率，無 UI 交付）

  TDD 標記（v7.0）:
    [TDD]  = 純計算/業務邏輯，CYNEFIN needsTest:true，需 TDD Contract Subagent 寫測試檔
    [DB]   = DB CRUD / 外部 API，Phase 2 只跑 tsc --noEmit
    [UI]   = 前端元件 / 路由，Phase 2 只跑 tsc --noEmit
-->

## TDD 測試需求

<!--
  只有 [TDD] 標記的 action 才填（[DB]/[UI] action 跳過）
  這裡是業務語意描述，具體測試檔由 TDD Contract Subagent 在 CYNEFIN @PASS 後撰寫
  格式: Given {前置} / When {動作} / Then {預期（具體值）}
-->

- {functionName}: Given {前置狀態} / When `{functionCall}({testInput})` / Then `{關鍵欄位}` = `{預期值}`

## 模組 API 摘要

- 對外 API: {functionA}(args): ReturnType, {functionB}(args): ReturnType
- 內部依賴: [{moduleName}.{typeName}]

<!--
  ## Demo Checkpoint（選填，FULL/QUALITY iter 建議補）
  列出可觀察的完成標準（跑什麼命令、看什麼結果）。
  例如：
  - `npm test` 全綠，無 skip
  - REVIEW 重跑後 Priority 1 項目清零
  - 某功能在 UI 操作後狀態保留
-->
---

## DR-040 / Structure-Ready 補充

- Draft 至少要有一種可機械解析的 structure 來源。
- 可接受格式 A:
  - 使用「動作清單」表格
  - 且每列至少具備 `類型 / 技術名 / 優先級 / 流向`
- 可接受格式 B:
  - 另外補 `module-actions`
  - 或 `module / publicAPI / deps` 區段
- 若兩者都沒有，`draft-gate` 會以 `DR-040` 擋下並輸出補法提示。

最小範例 A:

```md
| 描述 | 類型 | 技術名 | 簽名 | 優先級 | 流向 | 依賴 | TDD |
|------|------|--------|------|--------|------|------|-----|
| 甘特主區塊 | UI | GanttV5Grid | (props) => JSX.Element | P1 | READ->LAYOUT->RENDER | [gantt-layout] | [UI] |
```

最小範例 B:

```md
## Module Actions

- module: gantt
- publicAPI: GanttV5Grid, MilestoneTimelineMarkers
- deps: shared/date, lib/layout
- features: gantt-grid, milestone-stack
```
