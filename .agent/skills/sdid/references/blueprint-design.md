# Blueprint 設計模式 — 5 輪對話規則

## 概覽

Blueprint 是大方向設計模式，透過 5 輪結構化對話將模糊需求收斂為 Blueprint + Draft。
完成後存檔到：
- `{project}/.gems/design/blueprint.md`（全局索引，可選）
- `{project}/.gems/design/draft_iter-{N}.md`（per-iter 業務語意規格）

> **迭代號規則**: 存檔前先掃描 `{project}/.gems/iterations/` 找到最大的 iter-N，新建 iter-(N+1)。若無任何迭代目錄則從 iter-1 開始。

---

## 5 輪對話流程

| 輪次 | 焦點 | 產出 |
|------|------|------|
| 1 | 目標釐清 | 一句話目標 + 族群識別表 |
| 2 | 實體識別 | 實體定義表格 (欄位/型別/約束) |
| 3 | 模組拆分 | 共用模組 + 獨立模組 + 路由結構 |
| 4 | 迭代規劃 | 迭代規劃表 + Demo Checkpoint + 不做什麼 |
| 5 | 動作細化 | 模組動作清單 (業務語意→技術名稱)，強制垂直切片 |

---

## 每輪規則

### Round 1: 目標釐清
- MUST: 問「你想做什麼系統？解決什麼問題？誰會用？」
- FORBIDDEN-READ: src/*, .gems/*, task-pipe/*, *.cjs
- EXIT: 使用者確認一句話目標 + 族群表

### Round 2: 實體識別
- MUST: 問「系統需要管理哪些資料？每筆資料有什麼欄位？」
- FORBIDDEN-READ: src/*, task-pipe/*
- ALLOWED-READ: Round 1 對話紀錄
- 格式: `| 欄位 | 型別 | 約束 | 說明 |`
- EXIT: 使用者確認實體表格

### Round 3: 模組拆分
- MUST: 根據 Round 1-2 提出模組結構建議，問使用者確認
- MUST: 確認樣式策略 (CSS Modules / Tailwind / Global CSS / CSS-in-JS)
- ALLOWED-READ: [architecture-rules.md](architecture-rules.md)
- EXIT: 使用者確認模組結構 + 樣式策略

### Round 4: 迭代規劃

- MUST: 提出 MVP 範圍建議，問「第一版要做到什麼程度？」
- ALLOWED-READ: [action-type-mapping.md](action-type-mapping.md)
- shared 模組永遠在 Iter 1

**四條硬規則（不通過就不能進 Round 5）：**

**規則 1 — 每個功能性 iter 必含 SVC/API + ROUTE + UI（前後端一套）**
- Foundation iter（shared/infra）豁免
- 其餘所有 iter：迭代規劃表的「交付」欄必須為 `FULL`，不可寫 `BACKEND` 或 `FRONTEND`
- 動作清單必須同時含 `SVC 或 API`、`ROUTE`、`UI` 三種類型
- 禁止前後端分離不同 iter（如 iter-2 只有邏輯，iter-3 才有 UI）是 ❌ BLOCKER
- 每個 iter 交付後，使用者必須能操作完整功能，不是只看到 API 或只看到空 UI

**規則 1.5 — Iter 分層模型 (VSC-004，垂直切片原則)**

| 層級 | 適用 Iter | 內容 | 交付 | Story 拆法 |
|------|----------|------|------|-----------|
| Foundation | Iter 1 | 型別 + 配置 + API 介面契約 (interface) + 前端主入口殼 (AppRouter/Layout) | INFRA | Story-0: types/config, Story-1: API 介面 + 前端殼 |
| 業務模組 | Iter 2+ | 後端服務實作 → 前端串接 = 一個完整端到端業務流程 | FULL | Story-0: SVC/API 實作, Story-1: UI/ROUTE 串接 |

- Foundation 只放「形狀」(interface/type)，不放「行為」(實作/Mock)
- 業務模組 iter 必須是完整垂直切片：後端先行 → 前端串接
- 如果動作數超過 Action Budget，拆成多個 Story（不是多個 iter）
- ❌ 反模式：iter-2 做 Mock + 型別，iter-3 才做 UI；每個 iter 只有 Story-0

**規則 2 — 每個功能性 iter 可展示標準必備注**
- 迭代規劃表必須包含「可展示標準」一行：「操作者 + 操作步驟 + 預期畫面反應」
- Iter 1 允許寫 `npm run dev → 首頁不報錯`
- 不容許寫「系統完成初始化」之類無法親眼驗證的描述

**規則 3 — Complicated 模組拆分規則（CYNEFIN Budget 對齊）**
- CYNEFIN-CHECK 標記為 Complicated + q3_costly 的模組：每 iter 最多 4 個動作
- 如果模組有 N 個動作（N > 4），拆成多個 Story（不是多個 iter）
- Blueprint Gate 會機械檢查 BUDGET-001，超標 = ❌ BLOCKER
- 拆分策略：Story-0 放 SVC/API (後端先行)，Story-1 放 UI/ROUTE (前端串接)
- 拆分後每個 iter 仍須滿足規則 1（前後端一套）+ 規則 1.5（垂直切片）

**規則 4 — Action Budget（動作預算上限）**
- Level S: 每 iter 最多 3 個動作
- Level M: 每 iter 最多 4 個動作
- Level L: 每 iter 最多 5 個動作
- Foundation iter（只有 CONST/LIB/SCRIPT）豁免
- 超標 = ❌ BLOCKER，必須拆 iter 才能過 Gate

> 注：迭代規劃表用樣板里的格式：`| Iter | 範圍 | 目標 | 模組 | 依賴 | Story 數 | 必含類型 | 可展示標準 |`

- EXIT: 四條硬規則檢查通過 → 使用者確認

---

### Round 5: 動作細化

- MUST: 列出每個模組的具體動作，問使用者確認
- ALLOWED-READ: [action-type-mapping.md](action-type-mapping.md)
- 每個功能性 iter 最少 2 個 Story（iter 1 豁免）
  - Story-0: 後端 (SVC/API 實作)
  - Story-1: 前端串接 (UI/ROUTE 串接後端)
  - 如果動作數超過 Action Budget，拆更多 Story（不是更多 iter）

- 用 P0-P3 標記優先級，用 `→` 描述資料流向
- **前端類型 (UI/HOOK/ROUTE) 的流向必須描述業務行為，不是 React 框架機制**
  - UI: `FETCH_DATA`, `RENDER`, `BIND_EVENTS`, `FILTER`, `SORT` ✅ / `MOUNT`, `CONFIG`, `USEEFFECT` ❌
  - HOOK: `CALL_API`, `UPDATE_STATE`, `VALIDATE`, `DEBOUNCE`, `RETURN` ✅ / `USESTATE`, `USEEFFECT` ❌
  - ROUTE: `CHECK_AUTH`, `LOAD_DATA`, `RENDER_LAYOUT`, `RENDER_CONTENT` ✅ / `MOUNT`, `RENDER`（太泛）❌
  - 參考: [action-type-mapping.md](action-type-mapping.md)「前端類型 FLOW 詞彙」表
- EXIT: 使用者確認 → 組裝 Enhanced Draft

---

## 組裝 Blueprint + Draft

5 輪完成後產出兩個文件：

### 文件 1: Blueprint（全局索引，可選）
- 路徑: `{project}/.gems/design/blueprint.md`
- 內容: 目標、實體定義、路由結構、迭代規劃表、API 摘要（不含動作清單）
- 格式: `task-pipe/templates/blueprint-golden.template.v5.md`
- 範例: `task-pipe/templates/examples/blueprint-ecotrack.example.v5.md`
- 大小: ~100-150 行，不隨 iter 數膨脹

### 文件 2: Per-iter Draft（單一 iter 業務語意）
- 路徑: `{project}/.gems/design/draft_iter-{N}.md`
- 內容: 動作清單 + TDD 測試需求（只含當前 iter 的業務語意規格）
- 格式: `task-pipe/templates/draft-iter-golden.template.v5.md`
- 範例: `task-pipe/templates/examples/draft-iter-1-ecotrack.example.v5.md`

設定 Scale: S(每 iter ≤3 動作) / M(≤4) / L(≤5)
確認當前迭代號（掃描 `.gems/iterations/` 取最大 iter-N，遞增為 iter-(N+1)；無則 iter-1）
提示使用者：「Blueprint + Draft 已完成（iter-{N}），接下來執行 sdid-loop 進入三節點流程」

## Draft 完成後的三節點流程（強制）

> ⚠️ Draft 存檔後不是直接 BUILD，必須依序通過 Contract 和 Plan。

```
blueprint.md（可選）
  ↓ blueprint-gate
draft_iter-N.md（.gems/design/draft_iter-N.md）
  ↓ draft-gate
  ↓
[1] CONTRACT — AI 從 draft 推導型別邊界，寫 contract_iter-N.ts
    節點：contract-gate v5
    路徑：.gems/iterations/iter-N/contract_iter-N.ts
    產物: contract-gate-pass-*.log + contract_iter-N.ts
  ↓
[2] PLAN — 機械轉換 contract @CONTRACT → implementation_plan
    node task-pipe/tools/spec-to-plan.cjs --target=<project> --iteration=iter-N
    產物: implementation_plan_Story-N.Y.md + .ts 骨架
  ↓
BUILD Phase 1-4
  ↓
SCAN → functions.json
```

**CONTRACT 節點存在的理由：**
- draft 的 type 欄位是人工填的，容易語意模糊
- contract.ts 是型別邊界的 single source of truth，有完整 interface body
- plan-generator 直讀 contract @GEMS-STORIES，contract 精確 → plan 精確

> 實際執行透過 `sdid-loop` MCP tool 自動偵測並依序執行，不需要手動呼叫各工具。

---

## 全授權模式差異

內部推演 5 輪（每輪 AI 自己做決策，不問使用者）。
**每輪結束前必須自我對照以下 checklist，全部 ✅ 才能進入下一輪：**

| 檢查項目 | 完成標準 |
|---------|----------|
| Iter 1 有 ROUTE （AppRoot） | 從瀏覽器可看到首頁 |
| 每個功能性 iter 有 SVC/API | 至少一個邏輯層動作 |
| 每個功能性 iter 有 ROUTE | 至少一個頁面入口 |
| 每個功能性 iter 有 UI | 至少一個畫面元件 |
| 每個功能性 iter 交付類型 = FULL | 前後端一套，不可分離 |
| Foundation 含 API 介面契約 | IXxxService interface 定義形狀 |
| Foundation 含前端主入口殼 | AppRouter/Layout，npm run dev 可見 |
| Foundation 不含業務邏輯 | 禁止 Mock Service、計算函式 |
| 功能性 iter 是完整垂直切片 | 後端 SVC/API → 前端 UI/ROUTE |
| 功能性 iter 至少 2 Story | Story-0: 後端, Story-1: 前端串接 |
| 每個功能性 iter 有 Demo Checkpoint | 使用者操作後可親眼看到畫面 |
| 每 iter 動作數 ≤ Budget 上限 | S:3 / M:4 / L:5（Foundation 豁免） |

不中斷、不分批展示，最終一次性輸出組裝好的完整 Enhanced Draft + 「下一步：Contract → Plan → Build → Scan」結論。

**全授權模式額外規則 — 一次展開所有 Draft：**

Round 5 完成後，依迭代規劃表逐一產出**所有 iter** 的 draft（不只 iter-1）：

```
iter-1 → draft_iter-1.md（完整動作清單 + TDD 需求）
iter-2 → draft_iter-2.md（同上）
iter-N → draft_iter-N.md（同上）
```

每個 draft 的動作清單直接從 Round 5 對應模組的細化結果取用，不留 [STUB]。
Foundation iter（iter-1）和所有業務模組 iter 全部一次產出，不分批。

---

## 模板與範例

### v5 路線（推薦）
- Blueprint template: `task-pipe/templates/blueprint-golden.template.v5.md`
- Draft template: `task-pipe/templates/draft-iter-golden.template.v5.md`
- Blueprint example: `task-pipe/templates/examples/blueprint-ecotrack.example.v5.md`
- Draft example: `task-pipe/templates/examples/draft-iter-1-ecotrack.example.v5.md`

---

## 通用規則

- 一輪一個主題，不要一次問所有問題
- 使用者模糊時，提供 2-3 個具體選項
- 每輪結束用表格/清單摘要，確認後才進下一輪
- 不確定的標記 `[NEEDS CLARIFICATION]`
- 使用繁體中文
