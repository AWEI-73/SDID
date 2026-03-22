# Cynefin Check — 語意域分析指引

## 目的

在進入 PLAN/BUILD 前，對需求文件做 Cynefin 語意域分析，展開隱含複雜度。
避免「需求寫得很簡單，做到一半才發現很複雜」的情況。

## 輸入

- `.gems/design/draft_iter-N.md`（主要輸入，Blueprint / Task-Pipe 皆使用）
- 或 `requirement_spec_iter-N.md`（v5 舊路線相容）

---

## Phase 0: 前置確認

Draft 必須已通過 **design-review skill**（@PASS）才能進入 CYNEFIN-CHECK。

```
@BLOCKER：Draft 尚未通過 design-review → 返回執行 design-review skill
@PASS：繼續 Phase 0.5
```

> design-review 負責文件品質審查（tag 完整性、Then 語意、Entity 引用等）。
> 進到這裡代表文件結構已合格，CYNEFIN-CHECK 專注做域分析。

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
