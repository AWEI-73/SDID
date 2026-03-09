# Blueprint 設計模式 — 5 輪對話規則

## 概覽

Blueprint 是大方向設計模式，透過 5 輪結構化對話將模糊需求收斂為 Enhanced Draft。
完成後存檔到 `{project}/.gems/iterations/iter-{X}/poc/requirement_draft_iter-{X}.md`，
然後交給 BUILD-AUTO 模式（MCP `sdid-loop`）執行。

> **迭代號規則**: 存檔前先掃描 `{project}/.gems/iterations/` 找到最大的 iter-N，新建 iter-(N+1)。若無任何迭代目錄則從 iter-1 開始。

---

## BLUEPRINT-CONTINUE 模式（活藍圖續跑）

### 狀態流轉（完整循環）

```
主藍圖初始規劃
  iter-N 欄：[STUB]（只有概要，無 AC）
       ↓
  blueprint-shrink 執行（iter-N-1 完成後）
  → iter-N: [STUB] → [CURRENT]（shrink 自動升格）
  → 附加上一個 iter 的 Fillback suggestions 到 iter-N 備註
       ↓
  新 session BLUEPRINT-CONTINUE 觸發
  → 讀主藍圖，找到 [CURRENT] iter-N
  → 補 AC、Demo Checkpoint，產出完整 Stub Draft
  → 存到 iter-N/poc/requirement_draft_iter-N.md
       ↓
  BUILD Phase 1-8
       ↓
  blueprint-shrink 執行（iter-N 完成後）
  → iter-N: [CURRENT] → [DONE]
  → iter-N+1: [STUB] → [CURRENT]
       ↓
  下個 session BLUEPRINT-CONTINUE ...
```

**職責分工：**
- `blueprint-shrink`：狀態轉換（[STUB]→[CURRENT]、[CURRENT]→[DONE]）+ 傳遞 Fillback
- `BLUEPRINT-CONTINUE`：AC 補齊（概要→完整 Stub Draft）+ 產出 iter-N/poc/

---

### 觸發條件

進入 DESIGN-BLUEPRINT 時，**先掃描專案是否存在「活藍圖」**：

```
活藍圖 = iter-1/poc/requirement_draft_iter-1.md 存在
         且 藍圖狀態 = [~] ACTIVE
         且 迭代規劃表有 [CURRENT] 或 [STUB] 狀態的 iter
         且 該 iter 的 poc/ 下無 requirement_draft_iter-N.md（尚未展開）
```

若符合，**不需要 5 輪對話**，直接進入 BLUEPRINT-CONTINUE 模式。

### BLUEPRINT-CONTINUE 執行步驟

```
Step 1: 讀主藍圖（iter-1 的 requirement_draft_iter-1.md）
Step 2: 找目標 iter
        優先找 [CURRENT]（shrink 已升格，帶 Fillback suggestions）
        次找 [STUB]（shrink 尚未跑，需自行從概要展開）
        確認 iter-N/poc/ 下無既有 draft（避免重複展開）
Step 3: 從主藍圖的「模組動作清單」讀取 iter-N 的概要動作
        若 shrink 已附加 Fillback suggestions，一併讀取作為補齊參考
Step 4: 補齊 AC 與 Demo Checkpoint，產出完整 Stub Draft：
         - 格式同 Enhanced Draft
         - 開頭標注「承接主藍圖，展開 iter-N [{模組名}]」
         - 繼承主藍圖的實體定義、共用模組（不重複定義）
         - 每個 P0 動作必須有 Given/When/Then AC
Step 5: Blueprint Gate 驗證（同正常流程）
Step 6: 存到 {project}/.gems/iterations/iter-N/poc/requirement_draft_iter-N.md
Step 7: 提示使用者：「Iter-N ({模組名}) 已展開，接下來執行 BUILD 嗎？」
```

> 注意：Step 7 不再手動更新主藍圖狀態——[CURRENT]→[DONE] 由 blueprint-shrink 在 BUILD 完成後自動處理。

### 主藍圖 vs Stub Draft 的職責區分

| 文件 | 職責 | 更新者 |
|------|------|--------|
| `iter-1/poc/requirement_draft_iter-1.md` (主藍圖) | 全局規劃、迭代規劃表、實體定義、概要動作清單 | blueprint-shrink（狀態）/ 人工（規劃調整）|
| `iter-N/poc/requirement_draft_iter-N.md` (Stub Draft) | 單一 iter 的完整 AC、Demo Checkpoint | BLUEPRINT-CONTINUE（一次性寫入）|

### 主藍圖迭代狀態標記規則

在迭代規劃表中，每個 iter 必須有明確狀態標記：

| 狀態 | 含義 | 由誰轉換 |
|------|------|---------|
| `[STUB]` | 概要規劃，尚未升格 | 初始寫入 |
| `[CURRENT]` | shrink 升格後，等待本 session BLUEPRINT-CONTINUE 展開 | blueprint-shrink |
| `[DONE]` | BUILD + shrink 完成 | blueprint-shrink |

### BLUEPRINT-CONTINUE 條件判斷流程

```
新 session 進入 DESIGN-BLUEPRINT
  ↓
Q1: iter-1 draft 存在且狀態 = [~] ACTIVE？
  → No: 正常 5 輪對話
  → Yes: ↓

Q2: 有 [CURRENT] iter 且 iter-N/poc/ 無既有 draft？
  → Yes: BLUEPRINT-CONTINUE（Step 1，帶 Fillback suggestions）
  → No: ↓

Q3: 有 [STUB] iter 且 iter-N/poc/ 無既有 draft？
  → Yes: BLUEPRINT-CONTINUE（Step 1，從概要展開）
  → No: 全部完成或全部已展開，告知使用者狀態
```

### 全授權模式下的 BLUEPRINT-CONTINUE

使用者說「全部授權」時：

```
自動讀主藍圖 → 找 [CURRENT] 或 [STUB]（優先 CURRENT）
→ 補 AC → 產 Stub Draft → Gate 驗證 → 存檔
不問使用者，最終輸出：「Iter-N ({模組名}) 已展開 + 準備 BUILD」
```

---

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

**AC 兩條規則（不達標必須重寫）：**

1. **P0 動作 AC 不可為空**，格式：Given / When / Then
2. **Then 必須含效益指標**：描述使用者因此能做什麼或看到什麼

```
❌ 無效: Then 解析完成 / Then 回傳結果 / Then 寫入成功
✅ 有效: Then 題目清單顯示 N 筆，老師可立即進行組卷
✅ 有效: Then 成績頁顯示百分比與錯題清單，學生可知道哪些需加強
✅ 有效(純邏輯): Then 回傳 2 題無重複，確保每次考試題目多樣性
```

- 用 P0-P3 標記優先級，用 `→` 描述資料流向
- **前端類型 (UI/HOOK/ROUTE) 的流向必須描述業務行為，不是 React 框架機制**
  - UI: `FETCH_DATA`, `RENDER`, `BIND_EVENTS`, `FILTER`, `SORT` ✅ / `MOUNT`, `CONFIG`, `USEEFFECT` ❌
  - HOOK: `CALL_API`, `UPDATE_STATE`, `VALIDATE`, `DEBOUNCE`, `RETURN` ✅ / `USESTATE`, `USEEFFECT` ❌
  - ROUTE: `CHECK_AUTH`, `LOAD_DATA`, `RENDER_LAYOUT`, `RENDER_CONTENT` ✅ / `MOUNT`, `RENDER`（太泛）❌
  - 參考: [action-type-mapping.md](action-type-mapping.md)「前端類型 FLOW 詞彙」表
- EXIT: 使用者確認 → 組裝 Enhanced Draft

---

## 組裝 Enhanced Draft

5 輪完成後：
1. 組裝完整 Enhanced Draft Markdown
2. 設定 POC Level: S(≤3 Stories) / M(≤6) / L(≤10)
3. 確認當前迭代號（掃描 `.gems/iterations/` 取最大 iter-N，遞增為 iter-(N+1)；無則 iter-1）
4. 存到 `{project}/.gems/iterations/iter-{X}/poc/requirement_draft_iter-{X}.md`
5. 提示使用者：「Draft 已完成（iter-{X}），接下來執行 sdid-loop 進入三節點流程」

## Draft 完成後的三節點流程（Blueprint 路線強制）

> ⚠️ Draft 存檔後不是直接 BUILD，必須依序通過三個節點。

```
Enhanced Draft
  ↓
[1] CYNEFIN-CHECK — 語意域分析，展開隱含複雜度
    node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=<project> --iter=N
    產物: cynefin-check-pass-*.log
  ↓
[2] CONTRACT — 從 draft 推導型別邊界，寫 contract_iter-N.ts
    node sdid-tools/blueprint/contract-writer.cjs --contract=<path> --target=<project> --iter=N
    產物: contract-pass-*.log + contract_iter-N.ts
  ↓
[3] PLAN — 機械轉換 draft → implementation_plan，骨架注入 contract 型別
    node sdid-tools/blueprint/draft-to-plan.cjs --draft=<path> --iter=N --target=<project>
    產物: implementation_plan_Story-N.Y.md + .ts 骨架
  ↓
BUILD Phase 1-8
```

**為什麼需要 CONTRACT 節點：**
- draft 的 type 欄位（CONST/SVC/API）是人工填的，容易填錯（如把 `ITrainingService` 填成 CONST）
- contract.ts 是 Gem 對話後明確設計的型別邊界，有完整 interface body
- draft-to-plan 生成骨架時，contract 的 `@GEMS-API` 優先於 draft 的 type，確保 interface 不會消失
- **contract 是 draft 的收斂層，也是骨架生成的 source of truth**

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
| P0 動作的 AC 不為空 | Given/When/Then 格式 |
| AC 的 Then 含效益指標 | 使用者因此能做什麼或看到什麼 |

不中斷、不分批展示，最終一次性輸出組裝好的完整 Enhanced Draft + 「下一步：啟動 BUILD」結論。

---

## 模板與範例

- Golden template: `task-pipe/templates/enhanced-draft-golden.template.md`
- EcoTrack example: `task-pipe/templates/examples/enhanced-draft-ecotrack.example.md`

---

## 通用規則

- 一輪一個主題，不要一次問所有問題
- 使用者模糊時，提供 2-3 個具體選項
- 每輪結束用表格/清單摘要，確認後才進下一輪
- 不確定的標記 `[NEEDS CLARIFICATION]`
- 使用繁體中文
