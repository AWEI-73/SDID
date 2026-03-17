# Cynefin Check — 語意域分析指引

## 目的

在進入 PLAN/BUILD 前，對需求文件做 Cynefin 語意域分析，展開隱含複雜度。
避免「需求寫得很簡單，做到一半才發現很複雜」的情況。

## 輸入

- `draft_iter-N.md`（`.gems/design/draft_iter-N.md`）

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
| needsTest | **腳本自動計算**：domain=Complicated/Complex 或 hiddenSteps.length>=2 → true |

**needsTest 判斷規則**（cynefin-log-writer.cjs 自動計算，AI 也可手動填入覆蓋）：
- `domain === 'Complicated'` 或 `domain === 'Complex'` → `needsTest: true`
- `hiddenSteps.length >= 2` → `needsTest: true`
- 其他 → `needsTest: false`

**needsTest 的影響**：
- `needsTest: true` → ac-runner v3.0 為此 AC 生成 vitest test 檔（支援 @GEMS-AC-SETUP 前置步驟）
- `needsTest: false` → ac-runner 走舊的直接執行模式（向後相容）

將 actions[] 填入 JSON report，供 cynefin-log-writer.cjs 寫入 cynefin-report.json，再由 ac-runner v3.0 讀取決定哪些 AC 走 vitest 模式。

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

> ⚠️ CYNEFIN-CHECK @PASS 後的下一步是 **CONTRACT**（推導型別邊界），不是直接 PLAN。
> CONTRACT @PASS 後才進 PLAN（spec-to-plan）。
