# SDID 三路線客觀分析
**版本**: v1.0 | **日期**: 2026-03-05
**定位**: 供 AI 閱讀的結構化比較文件。描述 SDID 三條開發路線的設計意圖、適用條件、優缺點。
**受眾**: AI agent（用於路線選擇判斷）、外部工具比較參考

---

## 0. 前置定義

```
SDID = Structured Development with Iterative Design
       一套以「腳本驅動 + AI 執行」為核心的 AI 協作開發框架

三條路線:
  Task-Pipe  — 深度優先，單功能高品質
  Blueprint  — 廣度優先，多模組跨迭代
  POC-FIX    — 探索優先，複雜業務先跑通再固化
```

---

## 1. 路線總覽

```
┌─────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ 維度             │ Task-Pipe        │ Blueprint        │ POC-FIX          │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ 核心優勢         │ 品質（測試鏈完整） │ 廣度（產品全貌）   │ 探索（先跑通）    │
│ 適用規模         │ 單功能 / 小模組   │ 多模組 / 完整產品  │ 既有系統 / 未知域 │
│ 起點文件         │ requirement_draft │ Enhanced Draft   │ 既有程式碼        │
│ 函式邊界確定時機  │ POC 驗證後        │ Contract 推導後   │ micro-fix 後      │
│ 測試策略         │ TDD 強制          │ TDD 強制          │ 局部修復驗證      │
│ 迭代跨度         │ 單 iter 完整      │ 多 iter 演進      │ 單次修復          │
│ 前置成本         │ 中（POC 5步）     │ 高（5輪對話+Gate） │ 低（直接進）      │
│ 推導匯差風險     │ 低               │ 中（有 Contract 後降低）│ 低（局部）   │
└─────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

---

## 2. Task-Pipe 路線

### 2.1 流程

```
requirement_draft
  → POC Step 1（模糊消除）
  → POC Step 2（環境檢查）
  → POC Step 3（Contract 設計 — @GEMS-CONTRACT）
  → POC Step 4（UI 原型 — @GEMS-VERIFIED）
  → POC Step 5（需求規格 — requirement_spec）
  → spec-to-plan（機械轉換，無 AI 推導）
  → BUILD Phase 1-8
  → SCAN
```

### 2.2 設計意圖

POC 五步的核心是「在寫程式碼之前，先用可執行的原型驗證功能邊界」。
`@GEMS-VERIFIED` 標記哪些功能已驗證（進 iter-1），哪些未驗證（DEFERRED）。
`spec-to-plan` 是機械轉換，不依賴 AI 推導，所以 plan 的函式邊界準確。

### 2.3 優點

- 測試鏈完整：Unit → Integration → E2E 強制對應 P0/P1/P2
- 函式邊界在 POC 階段就確定，BUILD 時匯差極低
- `requirement_spec` 有 Scenario Table，AI 施工時有明確驗收條件
- 適合需要高可靠性的核心功能（金流、認證、資料一致性）

### 2.4 缺點

- 前置成本高：POC 5步 + spec 產出，才能進 BUILD
- 不適合多模組同時規劃：每個功能獨立走一遍 POC，跨模組依賴難以統一管理
- UI 原型（POC.html）是單一 HTML，複雜前端無法完整驗證
- 對「業務語意模糊」的需求，POC Step 1 容易卡住

### 2.5 適用條件

```
✅ 適合:
  - 功能邊界清楚（CRUD、API endpoint、資料處理）
  - 需要高測試覆蓋（P0/P1 函式）
  - 單一模組、獨立可測
  - iter-1 Foundation 建立

❌ 不適合:
  - 需求模糊、業務規則複雜
  - 多模組同時開發
  - 快速驗證產品方向
```

---

## 3. Blueprint 路線

### 3.1 流程

```
5輪對話（Gem chatbot）
  → Enhanced Draft（模組結構 + 迭代規劃 + 動作清單）
  → blueprint-gate（17項格式/語意檢查）
  → Cynefin Check（語意域分類）
  → CONTRACT（AI 從 draft 推導 @GEMS-CONTRACT）  ← 計畫中
  → draft-to-plan（draft + Contract → implementation_plan）
  → BUILD Phase 1-8（每個 Story）
  → blueprint-shrink（收縮 draft，標記完成）
  → [blueprint-expand → 下一個 iter]
  → blueprint-verify（最終驗證）
```

### 3.2 設計意圖

Enhanced Draft 是整個產品的「活藍圖」，一份文件管理多個 iter 的演進。
`blueprint-gate` 確保 draft 的結構完整性（DAG 無循環、動作類型合法、Flow 精確）。
Cynefin Check 判斷語意域，決定 Contract 的嚴格程度和 BUILD 策略。
`blueprint-shrink/expand` 讓 draft 隨著開發進展自動收縮/展開，保持 context 精準。

### 3.3 優點

- 一份 draft 管整個產品生命週期，跨 iter 依賴關係清楚
- 適合多模組同時規劃（模組清單 + 公開 API + 樣式策略）
- `blueprint-gate` 的 17 項檢查在進 BUILD 前就攔截架構問題
- Shrink/Expand 機制讓 AI context 隨迭代自動聚焦
- 適合「先規劃全貌，再逐步實作」的產品開發模式

### 3.4 缺點

- 前置成本最高：5輪對話 + Gate 通過才能進 BUILD
- 推導匯差：`draft-to-plan` 從業務語意推導函式邊界，有匯差風險（Contract 機制計畫中，加入後可降低）
- Enhanced Draft 品質依賴使用者的需求描述能力，模糊輸入 → 模糊輸出
- Gate 的 17 項檢查對新手有學習成本
- 前端 UI binding 規格（`@GEMS-UI-BIND`）在 draft 層難以精確描述

### 3.5 適用條件

```
✅ 適合:
  - 完整產品規劃（多模組、多 iter）
  - 需求相對清楚但範圍廣
  - iter-2 以後的功能擴展
  - 業務語意可以用動作清單描述

❌ 不適合:
  - 需求極度模糊（應先走 POC-FIX 探索）
  - 單一小功能（Task-Pipe 更輕量）
  - 既有系統局部修復
```

---

## 4. POC-FIX 路線

### 4.1 流程

```
既有程式碼 / 複雜業務邏輯
  → micro-fix-gate（局部變更範圍確認）
  → 修復循環（@TASK → 修改 → 重跑 gate）
  → gate-microfix-pass → 完成
```

### 4.2 設計意圖

針對「不確定性高、需要先探索再固化」的場景。
不走完整的 POC/Blueprint 流程，直接進入修復循環。
`micro-fix-gate` 確保修改範圍不超出預期（防止局部修復引發連鎖破壞）。
適合既有系統的 bug fix、效能優化、局部重構。

### 4.3 優點

- 前置成本最低：直接進修復循環
- 適合複雜業務邏輯的探索（先跑通，再定義邊界）
- `micro-fix-gate` 的範圍確認防止過度修改
- 不需要完整的 spec/plan 文件

### 4.4 缺點

- 沒有完整的測試鏈保障（只有局部驗證）
- 修復後的函式邊界可能不清楚，需要後續補 spec
- 不適合新功能開發（缺乏設計文件）
- 多次 POC-FIX 後，系統架構可能逐漸混亂（技術債累積）

### 4.5 適用條件

```
✅ 適合:
  - 既有系統 bug fix
  - 複雜業務邏輯探索（先跑通再說）
  - 效能優化、局部重構
  - 不確定性高、需要快速驗證假設

❌ 不適合:
  - 新功能開發（應走 Task-Pipe 或 Blueprint）
  - 需要完整測試覆蓋的核心功能
  - 多模組協作開發
```

---

## 5. 路線選擇決策樹

```
開始
  │
  ├─ 既有系統 + 局部修復/bug fix?
  │     └─ YES → POC-FIX
  │
  ├─ 全新功能 / 新專案?
  │     │
  │     ├─ 需求清楚 + 單一模組 + 需要高測試覆蓋?
  │     │     └─ YES → Task-Pipe
  │     │
  │     ├─ 多模組 + 需要產品全貌規劃 + 多 iter 演進?
  │     │     └─ YES → Blueprint
  │     │
  │     └─ 需求模糊 + 不確定性高?
  │           └─ YES → POC-FIX（探索）→ 確定後轉 Task-Pipe 或 Blueprint
  │
  └─ iter-1 Foundation + iter-2+ 功能擴展?
        ├─ iter-1 → Task-Pipe（建立型別/介面契約）
        └─ iter-2+ → Blueprint（基於 iter-1 擴展）
```

---

## 6. 三路線的共同機制

以下機制在三條路線中共用，是 SDID 框架的核心：

```
BUILD Phase 1-8    — 所有路線的實作階段共用
GEMS 標籤系統      — 函式邊界標記（@GEMS, [STEP], GEMS-FLOW 等）
state-machine.cjs  — 統一狀態推斷引擎（per-iter 路線偵測）
strategy drift     — 三層重試策略（TACTICAL_FIX → STRATEGY_SHIFT → PLAN_ROLLBACK）
project-memory     — 跨 iter 歷史記憶
functions.json     — 函式索引（AI 施工時的 context hub）
```

---

## 7. 已知限制（框架層面）

```
1. 前置成本
   Task-Pipe 和 Blueprint 的前置步驟較多，對「快速驗證想法」的場景不友好。
   POC-FIX 雖然輕量，但缺乏設計文件保障。

2. AI 依賴性
   框架假設 AI 能正確執行 @TASK 指示。AI 理解偏差會導致修復循環延長。
   腳本輸出的 @TASK 格式需要精確，否則 AI 容易腦補。

3. 學習曲線
   blueprint-gate 的 17 項檢查、GEMS 標籤格式、Cynefin 域分類，
   對新使用者有一定學習成本。

4. 推導匯差（Blueprint 特有）
   draft-to-plan 從業務語意推導函式邊界，語意越模糊匯差越大。
   Contract 機制（計畫中）可降低此風險，但尚未完整實作。

5. 前端規格精確度
   GEMS 標籤系統對後端邏輯的約束力強，但前端 UI binding 規格
   （@GEMS-UI-BIND）在複雜互動場景下難以完整描述。

6. 單一 HTML POC 限制（Task-Pipe 特有）
   POC.html 適合簡單 UI 驗證，複雜前端（多頁面、狀態管理）
   無法在單一 HTML 中完整驗證。
```

---

## 8. 與其他 AI 開發工具的比較維度

> 此節提供比較框架，具體工具數據請由比較方自行查閱最新資料。

```
建議比較維度:

A. 需求到程式碼的轉換方式
   - SDID: 結構化文件（draft/spec）→ 腳本驅動 → AI 執行
   - 其他工具: 自然語言 prompt → AI 直接生成

B. 函式邊界的確定機制
   - SDID: POC 驗證 / Contract 推導 / Gate 檢查
   - 其他工具: 通常依賴 AI 自行判斷

C. 測試策略
   - SDID: TDD 強制（P0/P1/P2 對應測試類型）
   - 其他工具: 通常可選

D. 跨迭代狀態管理
   - SDID: state.json + project-memory + log-based inference
   - 其他工具: 通常無跨 session 狀態

E. 架構漂移防護
   - SDID: strategy drift 三層重試 + Gate 系列檢查
   - 其他工具: 通常無

F. 適用規模
   - SDID: 中大型專案（多模組、多 iter）
   - 其他工具: 視工具而定

G. 前置成本
   - SDID: 較高（需要 draft/spec 文件）
   - 其他工具: 通常較低（直接 prompt）

H. 輸出可預測性
   - SDID: 高（腳本定義驗收條件，Gate 強制通過）
   - 其他工具: 視 prompt 品質而定
```

---

## 9. 版本記錄

```
v1.0 (2026-03-05): 初版，基於三路線討論整理
  - Task-Pipe / Blueprint / POC-FIX 客觀分析
  - 決策樹
  - 已知限制
  - 比較維度框架
```
