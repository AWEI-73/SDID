# Cynefin — Blueprint 複雜度分析指引

## 定位

Cynefin 是 **Blueprint 階段的內部分析工具**，用來輔助設計決策。

- 不是獨立的流程節點
- 不是 gate / phase / @PASS 條件
- 主流程為：Blueprint → Draft → Contract → Plan → Build 1-4 → Scan
- Cynefin 分析在 Blueprint 輪次內進行，幫助判斷 complexity / budget / needsTest / slicing

## 使用時機

Blueprint 5 輪對話中，遇到以下情況時做域分析：
- 動作的複雜度不確定
- iter 預算可能超標
- 需要判斷是否要寫 @TEST

## 輸入

- `.gems/design/draft_iter-N.md`（已通過 design-review）

---

## Phase 0.5: Action 層級分析

在模組域識別之後，對每個 action（動作清單中的每一行）做個別分析：

| 欄位 | 說明 |
|------|------|
| name | 動作的技術名稱（techName，對應 @GEMS-STORY-ITEM 第一欄） |
| story | 所屬 Story |
| domain | Clear/Complicated/Complex |
| hiddenSteps | 這個 action 的隱含步驟（陣列） |
| needsTest | **腳本自動計算**：domain=Complicated/Complex 或 hiddenSteps.length>=2 → true |

**needsTest 判斷規則**（cynefin-log-writer.cjs 自動計算，AI 也可手動填入覆蓋）：
- `domain === 'Complicated'` 或 `domain === 'Complex'` → `needsTest: true`
- `hiddenSteps.length >= 2` → `needsTest: true`
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

**needsTest 的影響**：
- `needsTest: true` → Contract 階段為此 action 加入 `@TEST:` 路徑，Phase 2 執行 vitest
- `needsTest: false` → Phase 2 只跑 `tsc --noEmit`（DB CRUD / UI / 外部 API 層）

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

## 分析結果的用途

分析完成後，結果用於 Blueprint 輪次的設計決策：

- **domain=Complicated/Complex 或 hiddenSteps≥2** → 在 Blueprint 記錄 `needsTest:true`，供 Contract 階段參考
- **預算超標** → 在 Blueprint 調整 iter 拆分
- **domain=Complex** → Blueprint 建議先做 POC 驗證再進 Contract

> ⚠️ 分析結果不產生 @PASS/@BLOCKER。主流程由 draft-gate / contract-gate 管控。
> flow-review 為 optional，可在 Blueprint 內部使用，不與主流程綁定。
