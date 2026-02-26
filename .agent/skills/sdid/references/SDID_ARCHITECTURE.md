# SDID 框架完整架構說明書

**版本**: v2.3
**最後更新**: 2026-02-25
**維護者**: 透過對話補充，有新機制就加進來

---

## 一、框架定位

SDID（Script-Driven Iterative Development）是一套**以 Gate 為核心的迭代開發框架**。

核心理念：
- **Gate 驅動**：每個階段有明確的通過條件，不通過就不能進下一步
- **漸進交付**：每個 iter 交付一個可展示、可操作的完整功能切片
- **機械執行**：盡量讓 script 做決策，AI 只做人判斷不了的事

---

## 二、進入判斷與路線

### 2.1 路線選擇指引（先問這個）

**開始任何專案前，先問一個問題：**

> **「UI 版面和操作流程確認了嗎？」**

```
No（版面未確認）→ Task-Pipe 優先
  → POC Step 1-4 快速建 UI 骨架（可點擊、可看版面）
  → 使用者確認版面和流程
  → Step 5 收斂 SPEC → PLAN → BUILD
  → MVP 確認後，後續擴充改走 BLUEPRINT-CONTINUE

Yes（版面已確認）→ 看需求複雜度
  → 需求模糊 → Blueprint 路線（5 輪對話）
  → 需求明確 → Task-Pipe 路線
```

**為什麼這個問題最重要：**

Blueprint 路線不驗證 UI，AI 根據描述自己決定版面。跑完才發現不對，Plan 和 Build 都已建好，改起來成本很高。Task-Pipe 的 POC 步驟天然就是 UI 驗證機制——先看到再決定。

### 2.2 全局架構圖

```
使用者意圖
  ├─ 「小修」「fix」「改一下」
  │     ↓
  │   MICRO-FIX（旁路）
  │   直接改 → micro-fix-gate → 完成
  │   不經過 CYNEFIN / Gate / BUILD
  │
  └─ 需求開發（新功能、新專案、繼續開發）
        │
        ├─ 有主藍圖 + 有 [STUB]/[CURRENT]
        │     ↓
        │   BLUEPRINT-CONTINUE（續跑，見第三章）
        │
        ├─ UI 版面未確認（新專案初期）
        │     ↓
        │   Task-Pipe 優先（POC 先確認版面）
        │   → MVP 確認後 → BLUEPRINT-CONTINUE 接手擴充
        │
        ├─ 需求模糊（版面已確認）
        │     ↓
        │   Blueprint 路線（5 輪對話）
        │
        └─ 需求明確（版面已確認）
              ↓
            Task-Pipe 路線（POC Step 1-5）
```

### 2.2 兩條正式路線

```
Blueprint 路線                             Task-Pipe 路線
        ↓                                          ↓
  5 輪對話 / CONTINUE                        POC Step 1-5
        ↓                                          ↓
  Enhanced Draft                            requirement_draft
        ↓                                          ↓
  ┌─────────────────────────────────────────────────┐
  │              CYNEFIN-CHECK（必跑）               │
  │    分析模組語意域 → 確認 Budget 符合規範          │
  └─────────────────────────────────────────────────┘
        ↓                                          ↓
  Blueprint Gate                            PLAN Step 1-5
        ↓                                          ↓
  draft-to-plan                             implementation_plan
        ↓                                          ↓
  ┌─────────────────────────────────────────────────┐
  │              BUILD Phase 1-8（共用）             │
  └─────────────────────────────────────────────────┘
        ↓                                          ↓
  SHRINK → VERIFY                               SCAN
```

### 2.3 MICRO-FIX（旁路，不算路線）

**觸發詞**：「小修」「fix」「改一下」「quick fix」「micro fix」

**Escalation Check**（先判斷，再決定走哪條路）：
```
單一檔案/函式、"just fix" → MICRO-FIX
多模組、架構調整、新功能 → 升級到正常 SDID 流程
```

**步驟**：
1. 確認要改什麼（一句話）
2. 直接修改
3. `node sdid-tools/micro-fix-gate.cjs --changed=<file> --target=<project>`
4. @PASS → 完成；@BLOCKER → 修復重跑

**不做的事**：不寫測試、不跑完整 BUILD、不需要 story/plan、不經過 CYNEFIN。

---

## 三、Blueprint 路線詳解

### 3.1 從零開始（新專案）

**5 輪對話**（`blueprint-design.md`）：

| 輪次 | 產出 | 關鍵規則 |
|------|------|---------|
| Round 1 | 一句話目標 + 族群表 | 禁讀 src/、.gems/ |
| Round 2 | 實體定義表格 | 欄位/型別/約束 |
| Round 3 | 模組結構 | 共用 + 獨立模組 |
| Round 4 | 迭代規劃表 | **四條硬規則**（見 3.2） |
| Round 5 | 模組動作清單 | P0 AC 必須 Given/When/Then |

**主藍圖密度設計**（漸層遞減）：

```
iter-1：完整動作 + 完整 AC（當前施工層）
iter-2：動作清單 + 模組名（概要）
iter-3+：只有迭代規劃表一行（更粗概要）
```

這樣初始文件不會太肥，每次 BLUEPRINT-CONTINUE 只展開一層。

### 3.2 四條硬規則（Round 4）

| 規則 | 內容 | 違反後果 |
|------|------|---------|
| 規則 1 | 每個功能性 iter 必含 SVC/API + ROUTE + UI（前後端一套） | BLOCKER VSC-003 |
| 規則 2 | 迭代規劃表必須有「可展示標準」（操作者+步驟+畫面反應） | 不能過 Round 4 |
| 規則 3 | Complicated+costly 模組每 iter 最多 4 個動作 | BLOCKER BUDGET-001 |
| 規則 4 | Action Budget：S≤3 / M≤4 / L≤5（Foundation iter 豁免） | BLOCKER BUDGET-001 |

### 3.3 BLUEPRINT-CONTINUE 模式（多 session 續跑）

**解決問題**：大型專案 8-12 個 iter，不可能一個 session 全跑完。

**狀態流轉**：

```
主藍圖初始：iter-N 欄為 [STUB]（概要規劃）
     ↓
blueprint-shrink 執行（上一個 iter BUILD 完成後）
     → iter-N: [STUB] → [CURRENT]（自動升格）
     → 附加 Fillback suggestions 到 iter-N 備註
     ↓
新 session 觸發 BLUEPRINT-CONTINUE
     → 讀主藍圖，找 [CURRENT] iter-N
     → 補 AC + Demo Checkpoint（概要→完整 Stub Draft）
     → 存到 iter-N/poc/requirement_draft_iter-N.md
     ↓
BUILD Phase 1-8
     ↓
blueprint-shrink 執行
     → iter-N: [CURRENT] → [DONE]
     → iter-N+1: [STUB] → [CURRENT]
```

**觸發條件**（SKILL.md 路由）：
```
iter-1 主藍圖存在（ACTIVE）
且 有 [CURRENT] 或 [STUB] iter
且 該 iter 的 poc/ 下無既有 draft
→ 自動走 BLUEPRINT-CONTINUE，不執行 5 輪對話
```

**職責分工**：

| 工具 | 職責 |
|------|------|
| `blueprint-shrink.cjs` | 狀態轉換（[STUB]→[CURRENT]→[DONE]）+ 傳遞 Fillback |
| `BLUEPRINT-CONTINUE`（AI） | AC 補齊，概要→完整 Stub Draft |
| 主藍圖 MD | 全局規劃、狀態記錄（唯一來源）|
| iter-N/poc/ draft | 單一 iter 完整規格（一次性寫入）|

---

## 四、CYNEFIN-CHECK

**時機**：兩條路線進入 PLAN 前，強制執行。

**三個步驟**（不可跳過）：
```
Step A: 讀 cynefin-check.md，對輸入文件做語意域分析
Step B: 寫 cynefin-report-<timestamp>.json → .gems/iterations/iter-N/logs/
Step C: node sdid-tools/cynefin-log-writer.cjs → @PASS 或 @NEEDS-FIX
```

**語意域分類**：

| 域 | 判斷標準 | Budget |
|----|---------|--------|
| Clear | 標準化流程，無歧義 | 不限 |
| Complicated+costly | 需要專家，有代價 | **每 iter ≤ 4 個動作** |
| Complicated+!costly | 需要專家，代價低 | 每 iter ≤ 6 個動作 |
| Complex | 實驗性，涉及外部 API | 每 iter ≤ 3 個動作 |

**iterBudget 機械執行**：
```json
"iterBudget": {
  "actionCount": 6,
  "maxPerIter": 4,
  "suggestedIters": 2,
  "currentIters": 1
}
```
`cynefin-log-writer.cjs` 讀此欄位，自動產出 BLOCKER。

---

## 五、Blueprint Gate

**時機**：Enhanced Draft 完成後，進 PLAN 前。

**執行**：
```bash
node sdid-tools/blueprint-gate.cjs --draft=<path> --level=M
```

**核心規則**（Gate 機械檢查）：

| 規則碼 | 內容 | 嚴重度 |
|--------|------|--------|
| VSC-001 | 功能性 iter 缺少 SVC/API | BLOCKER |
| VSC-002 | 功能性 iter 缺少 ROUTE 或 UI | BLOCKER |
| VSC-003 | delivery = BACKEND 或 FRONTEND（非 FULL）| BLOCKER |
| BUDGET-001 | iter 動作數超過 Level 上限 | BLOCKER |
| BUDGET-002 | iter 動作數等於上限（邊界警告）| WARN |

---

## 六、BUILD Phase 1-8

**兩條路線共用**，差異只在進入腳本：

```bash
# Blueprint 路線
node .agent/skills/sdid/scripts/blueprint-loop.cjs --project=[path]

# Task-Pipe 路線
node .agent/skills/sdid/scripts/taskpipe-loop.cjs --project=[path]
```

**八個 Phase**：

| Phase | 名稱 | Gate 條件 |
|-------|------|----------|
| 1 | 骨架檢查 | 環境、目錄結構存在 |
| 2 | 標籤驗收 | GEMS 標籤覆蓋率 ≥80% + **STUB-001**（見 6.1）|
| 3 | 測試腳本 | 測試檔案存在且格式正確 |
| 4 | Test Gate | 測試 import 被測函式 |
| 5 | TDD 執行 | Unit/Integration 全過 |
| 6 | 整合測試 | 路由、模組匯出可用 |
| 7 | 整合檢查 | 跨模組依賴無斷裂 |
| 8 | Fillback | 產出 Fillback + iteration_suggestions.json |

### 6.1 STUB-001（Phase 2 新增）

**問題背景**：AI 可以寫出含正確 GEMS 標籤的空骨架，標籤掃描全過但沒有實作，
Phase 2 之前無法偵測這種「格式正確、語意為空」的情況。

**偵測邏輯**（雙層）：
```
Layer 1（快篩）：function-index.json size ≤ 5 行
Layer 2（確認）：原始碼內容含以下任一：
  - return [] / return {} / return null / return undefined
  - // TODO
  - throw new Error('not implemented' | 'stub')
  - 只有 GEMS 標籤行，無任何實作
```

**嚴重度**：
- P0 函式 → BLOCKER（阻擋 Phase 2）
- P1 函式 → WARN（顯示警告，不阻擋）
- P2/P3 → 不檢查

**向後相容**：function-index.json 不存在時跳過（不阻擋舊專案）。

---

## 七、工具一覽

| 工具 | 路徑 | 職責 |
|------|------|------|
| `cynefin-log-writer.cjs` | `sdid-tools/` | CYNEFIN 報告 → @PASS/@NEEDS-FIX |
| `blueprint-gate.cjs` | `sdid-tools/` | Enhanced Draft 靜態分析 |
| `blueprint-shrink.cjs` | `sdid-tools/` | 折疊已完成 iter + 升格下一個 STUB |
| `blueprint-verify.cjs` | `sdid-tools/` | VERIFY 階段驗收 |
| `blueprint-expand.cjs` | `sdid-tools/` | 展開 Blueprint 到 Task-Pipe 格式 |
| `draft-to-plan.cjs` | `sdid-tools/` | Enhanced Draft → implementation_plan |
| `micro-fix-gate.cjs` | `sdid-tools/` | 小修後的快速 gate |
| `phase-2.cjs` | `task-pipe/phases/build/` | 標籤驗收 + STUB-001 |
| `blueprint-loop.cjs` | `.agent/skills/sdid/scripts/` | Blueprint 路線主迴圈 |
| `taskpipe-loop.cjs` | `.agent/skills/sdid/scripts/` | Task-Pipe 路線主迴圈 |

---

---

## 八、Gate 全覽（通過條件速查）

| Gate | 位置 | 主要規則 | 工具 |
|------|------|---------|------|
| CYNEFIN Gate | PLAN 前 | Budget 符合語意域 | cynefin-log-writer.cjs |
| Blueprint Gate | PLAN 前 | VSC-001/002/003 + BUDGET-001/002 | blueprint-gate.cjs |
| Phase 2 Gate | BUILD Phase 2 | GEMS 標籤 ≥80% + STUB-001 | phase-2.cjs |
| Phase 4 Gate | BUILD Phase 4 | 測試 import 驗證 | phase-4.cjs |
| Phase 5 Gate | BUILD Phase 5 | 所有測試通過 | phase-5.cjs |
| SHRINK Gate | BUILD 完成後 | 主藍圖折疊 + 升格 | blueprint-shrink.cjs |
| VERIFY Gate | SHRINK 後 | 最終交付驗收 | blueprint-verify.cjs |
| Micro-Fix Gate | 小修後 | 局部變更不破壞結構 | micro-fix-gate.cjs |

---

## 九、檔案結構（專案根目錄）

```
{project}/
├── src/                          ← 源碼（模組化結構）
│   └── modules/{module}/
│       ├── services/
│       ├── components/
│       └── pages/
├── .gems/
│   ├── docs/
│   │   ├── function-index.json   ← 函式索引（Phase 2 STUB-001 用）
│   │   ├── system-blueprint.json ← 系統統計
│   │   └── CONTRACT.md           ← API 合約
│   └── iterations/
│       ├── iter-1/
│       │   ├── poc/
│       │   │   └── requirement_draft_iter-1.md  ← 主藍圖（Living Blueprint）
│       │   ├── plan/
│       │   │   └── implementation_plan_Story-1.0.md
│       │   ├── build/
│       │   │   ├── Fillback_Story-1.0.md
│       │   │   └── iteration_suggestions_Story-1.0.json
│       │   └── logs/
│       │       ├── cynefin-report-<ts>.json
│       │       └── gate-check-pass-<ts>.log
│       └── iter-N/               ← 各 iter Stub Draft + 執行產物
└── .agent/skills/sdid/           ← SDID 框架（不修改）
```

---

## 十、已知設計限制與後續補充空間

| 項目 | 狀態 | 說明 |
|------|------|------|
| STUB-001 path 解析 | ⚠ 需測試 | function-index.json 的路徑可能是 Windows 絕對路徑，需確認 resolve 邏輯在各平台正確 |
| BLUEPRINT-CONTINUE 自動觸發 | ✅ 已實作（SKILL.md 路由）| 新 session 進 DESIGN-BLUEPRINT 自動偵測 |
| shrink 升格邏輯 | ✅ 已確認（shrink.cjs L251-260）| [STUB]→[CURRENT] 已實作 |
| Phase 2 STUB-001 | ✅ 已實作 | 10/10 測試通過 |
| function index 掃描時機 | ✅ Phase 8 Fillback 自動更新 | 不需要手動維護 |
| 多 session 主藍圖狀態同步 | ✅ shrink 自動維護 | 不需要 AI 手動更新 |

---

*本說明書由對話自動更新。有新機制、新 Gate、新規則，直接補到對應章節。*
