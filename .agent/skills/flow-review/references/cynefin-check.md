# Cynefin Check — 語意域分析指引

## 目的

在進入 PLAN/BUILD 前，對需求文件做 Cynefin 語意域分析，展開隱含複雜度。
避免「需求寫得很簡單，做到一半才發現很複雜」的情況。

## 輸入

- `.gems/design/draft_iter-N.md`（主要輸入，Blueprint / Task-Pipe 皆使用）
- 或 `requirement_spec_iter-N.md`（v5 舊路線相容）

---

## Phase 0: 文件品質評分（前置判斷）

在做域分析之前，先對輸入文件做品質評分。
如果文件本身品質不足，域分析的結果也不可靠。

### 評分維度（每項 0-5 分，滿分 25）

| 維度 | 0 分 | 3 分 | 5 分 |
|------|------|------|------|
| 明確性 | 全是模糊描述 | 大部分明確，少數模糊 | 每個功能都有具體行為描述 |
| 完整性 | 只有標題 | 有功能列表但缺細節 | 功能、邊界、錯誤處理都有 |
| 可測試性 | 無法寫測試 | 部分可寫測試 | 每個功能都能對應測試案例 |
| 一致性 | 自相矛盾 | 小處不一致 | 術語統一、邏輯自洽 |
| 可行性 | 技術上不可能 | 需要額外研究 | 技術方案明確可行 |

### 門檻

| 總分 | 判定 | 動作 |
|------|------|------|
| 20-25 | ✅ PASS | 繼續域分析 |
| 15-19 | ⚠️ WARN | 標記弱項，繼續但在 report 中註記 |
| 0-14 | ❌ FAIL | 退回修改文件，不進行域分析 |

---

## Phase 0.5: Action 層級分析

在模組域識別之後，對每個 action（動作清單中的每一行）做個別分析：

| 欄位 | 說明 |
|------|------|
| name | 動作的技術名稱（techName，對應 @GEMS-STORY-ITEM 第一欄） |
| story | 所屬 Story |
| domain | Clear/Complicated/Complex |
| hiddenSteps | 這個 action 的隱含步驟（陣列） |
| concernLayers | 此 action 涉及的架構層（見 Enum，可多個） |
| needsTest | **腳本自動計算**（見下方規則） |
| splitRequired | **腳本自動計算**（見下方規則）—優先於 needsTest |

### 架構層 Enum

```
visual | state | api | db | compat | routing | validation | calculation | external
```

每個 action 分析時，標記其 hiddenSteps 及 FLOW 中涉及的層，填入 `concernLayers[]`。

### splitRequired 判斷規則（優先檢查，比 needsTest 更強）

```
P0/P1 UI action，且：
  concernLayers 涉及 (visual 或 state) + (api 或 db 或 compat)
  → splitRequired: true，verdict: NEEDS_FIX（退回 Draft 拆分）
```

**`splitRequired: true` 的含義**：這個 action 不是「複雜的單一事情」，而是「多件事被包在一起」，必須在 Draft 拆開，不能靠 TDD 解決。

### needsTest 判斷規則（splitRequired=false 才評估）

- `domain === 'Complicated'` 或 `domain === 'Complex'` → `needsTest: true`
- `hiddenSteps.length >= 2` 且同一架構層 → `needsTest: true`
- Complicated UI action 且 concernLayers 單層但 observable behaviors >= 3 → `needsTest: true`
- 其他 → `needsTest: false`

---

### ⚠️ 強制升級為 Complicated 的 Action 特徵（不得標 Clear）

以下任一特徵符合，**必須**將 domain 標為 `Complicated` 並補上對應 hiddenStep，不得以「看起來只是 map/loop」為由標 Clear：

| 特徵 | 說明 | 必加 hiddenStep |
|------|------|----------------|
| **FK 繼承** | Action 的輸出物件需包含來自**上層物件**的 ID（如 `taskId` 來自 `project.id`、`orderId` 來自 `order.id`） | `"FK 繼承正確性"` |
| **Tree → Flat 映射** | 將巢狀/階層結構（tree/nested）打平為 DB 可儲存的列格式（flat rows） | `"巢狀層級對應正確性"` |
| **跨實體 ID 注入** | 子物件需在 mapping 時手動帶入父物件 ID，且此 ID 不在子物件原始資料中 | `"跨實體 ID 補充完整性"` |
| **多目標寫入** | 單一 action 對 2 個以上資料表/Sheet 執行 append/update（批次寫入） | `"多目標寫入一致性"` |
| **整合邊界切換** | 程式碼路徑依賴環境變數分支（如 `IS_MOCK`、`USE_REAL_API`），mock 路徑與 real 路徑行為不同 | `"mock/real 行為對稱性"` |
| **外部服務呼叫** | 呼叫 GAS、Stripe、Firebase 等外部 API，有 quota、auth、rate-limit 等隱性邊界 | `"外部服務錯誤邊界"` |

> **背景**：`seedMockData`（iter-5）因「看起來只是 loop+map」被標 Clear，但其中 milestone 需從 project 繼承 `taskId`（FK 繼承特徵），導致 `taskId` 漏填進 GAS，前端查無資料。上述規則直接從此 bug 歸納。

---

**分析結果的影響**：
- `splitRequired: true` → 回傳 NEEDS_FIX，退回 Draft 階段拆分，**不進入 Contract**
- `needsTest: true` → CYNEFIN @PASS 後，Controller 派 **TDD Contract Subagent**（見 `tdd-contract-prompt.md`），為此 action 寫測試檔並將 `@GEMS-TDD` 路徑加入 contract.ts，再由 Design Reviewer 審查，之後 Phase 2 執行 vitest
- `needsTest: false` → Phase 2 只跑 `tsc --noEmit`（DB CRUD / UI / 外部 API 層）

將 actions[] 填入 JSON report，供 cynefin-log-writer.cjs 寫入 cynefin-report.json，再由 Controller 讀取決定哪些 action 需要 TDD Contract Subagent 寫測試。

---

## Phase 1: 模組域識別

對每個模組/功能做三問判定：

| 問題 | Clear | Complicated | Complex |
|------|-------|-------------|---------|
| 因果關係明確嗎？ | ✅ 直接可見 | ⚠️ 需要分析 | ❌ 事後才知道 |
| 有已知最佳實踐嗎？ | ✅ 有標準做法 | ⚠️ 需要專家判斷 | ❌ 需要實驗 |
| 需求會變動嗎？ | ✅ 穩定 | ⚠️ 可能微調 | ❌ 高度不確定 |

---

## Phase 2: 隱含步驟展開

對每個 Complicated/Complex 模組，展開隱含步驟：

- 錯誤處理（error boundary、retry、fallback）
- 狀態管理（loading、error、empty state）
- 邊界條件（空值、超長、並發）
- 資料驗證（input validation、type guard）
- 效能考量（大量資料、分頁、快取）

---

## Phase 3: 預算檢查

| 域 | 每 iter 動作上限 | 超出處理 |
|----|-----------------|---------|
| Clear | 不限 | — |
| Complicated | 4 個動作 | 拆成多個 iter |
| Complex | 2 個動作 | 必須先做 POC 驗證 |

---

## 輸出格式

產出 JSON report，格式如下：

```json
{
  "route": "Blueprint|TaskPipe",
  "inputFile": "path/to/draft.md",
  "modules": [
    {
      "name": "模組名稱",
      "domain": "Clear|Complicated|Complex",
      "threeQuestions": {
        "q1_clear": true,
        "q2_reference": false,
        "q3_costly": true
      },
      "flowSteps": 4,
      "depsCount": 2,
      "timeCoupling": false,
      "iterBudget": {
        "actionCount": 6,
        "maxPerIter": 4,
        "suggestedIters": 2,
        "currentIters": 1
      },
      "issues": [
        {
          "level": "BLOCKER|WARNING|INFO",
          "description": "問題描述",
          "suggestions": ["建議1", "建議2"],
          "fixTarget": "需修改的文件路徑"
        }
      ]
    }
  ],
  "actions": [
    {
      "name": "addTransaction",
      "story": "Story-1.0",
      "domain": "Clear",
      "hiddenSteps": ["UUID 生成"],
      "needsTest": false
    },
    {
      "name": "getTransactions",
      "story": "Story-1.0",
      "domain": "Complicated",
      "hiddenSteps": ["月份過濾邊界", "日期降序排列"],
      "needsTest": true
    }
  ],
  "verdict": "PASS|NEEDS_FIX",
  "issues": []
}
```

### iterBudget 填寫規則

**必填**，腳本會根據此欄位機械判定預算是否超標：

| 欄位 | 說明 | 範例 |
|------|------|------|
| `actionCount` | 此模組在本 iter 的動作數（Story 數 × 平均動作數） | `6` |
| `maxPerIter` | 依域設定上限：Clear=不限(999)、Complicated=4、Complex=3 | `4` |
| `suggestedIters` | `ceil(actionCount / maxPerIter)` | `2` |
| `currentIters` | 目前規劃的 iter 數（通常是 1） | `1` |

若 `currentIters < suggestedIters` 且域為 Complicated(costly) 或 Complex，腳本自動產生 BLOCKER。

---

## 完成後

產出 JSON report，儲存到：
```
{project}/.gems/iterations/iter-N/logs/cynefin-report-<timestamp>.json
```

執行以下指令寫入 log：

```bash
node sdid-tools/cynefin-log-writer.cjs --report-file=<上述路徑> --target=<project> --iter=<N>
```

log 寫入成功後才算 `@PASS`，loop 才會放行進入 **CONTRACT** 節點。

> ⚠️ CYNEFIN-CHECK @PASS 後：
> 1. 若有 `needsTest: true` 的 action → 先派 **TDD Contract Subagent**（寫測試檔 + 加 @GEMS-TDD）→ 再派 **Design Reviewer** 審查 contract
> 2. 所有測試檔準備完畢 → **CONTRACT Gate**（contract-gate.cjs v5）
> 3. CONTRACT @PASS → **PLAN**（spec-to-plan.cjs，機械轉換）
> 4. PLAN → **BUILD Phase 1-4**
