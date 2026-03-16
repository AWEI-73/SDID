# Draft iter-{N}: {模組名稱}

**迭代**: iter-{N}
**模組**: {moduleName}
**目標**: {一行描述此 iter 要達成什麼}
**依賴**: {前置 iter 或模組，例如 shared (iter-1)}

<!--
  Per-iter Draft v5 — 單一迭代的業務語意規格
  
  職責：動作清單 + AC 骨架（人的語言）
  不含：實體定義、路由結構、迭代規劃表（這些在 Blueprint）
  
  產出時機：AI 讀 Blueprint 迭代規劃表 + 前 iter contract 介面後逐個產出
  輸入：Blueprint + 前 iter contract（介面邊界）
  輸出：此檔案 → 過 contract-writer gate → contract_iter-N.ts
  
  @CONTEXT_SCOPE:
    READ: blueprint.md, contract_iter-{N-1}.ts (介面參考)
    SKIP: 其他 iter 的 draft, 其他 iter 的 contract 內容
-->

---

## Story 拆法

> {說明此 iter 的 Story 怎麼拆，例如: Story-0 後端服務, Story-1 前端串接}

## 動作清單

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | AC |
|---------|------|---------|-----------|---|------|------|----|
| {業務描述} | {SVC/UI/ROUTE/CALC/CONST/CREATE/READ/MODIFY/DELETE} | {functionName} | ({param}: {Type}) → {ReturnType} | P{0-3} | {STEP1→STEP2→RETURN} | [{dep}] | AC-{N}.{M} [{TAG}] |

<!--
  類型對照:
    SVC = 服務函式    UI = 前端元件      ROUTE = 路由/頁面
    CALC = 計算邏輯   CONST = 常數/型別   CREATE/READ/MODIFY/DELETE = CRUD
  
  AC TAG:
    [CALC] = 純計算，ac-runner 可機械驗收
    [MOCK] = 需 mock 資料，ac-runner 可驗收
    [MANUAL] = UI/外部依賴，人工驗收
    [SKIP] = 編譯驗證等非 runtime 測試
-->

## AC 骨架

<!--
  P0/P1 必填，P2/P3 可選
  格式: AC-{N}.{M} [{TAG}] — {技術名稱}: Given {前置} / When {動作} / Then {預期}
-->

- AC-{N}.0 [{TAG}] — {技術名稱}: Given {前置狀態} / When `{functionCall}({testInput})` / Then `{關鍵欄位}` = `{預期值}`
- AC-{N}.1 [{TAG}] — {技術名稱}: Given {前置狀態} / When {動作} / Then {預期結果}

## 模組 API 摘要

- 對外 API: {functionA}(args): ReturnType, {functionB}(args): ReturnType
- 內部依賴: [{moduleName}.{typeName}]
