# Cynefin Check — 語意域分析指引

## 目的

在進入 PLAN/BUILD 前，對需求文件做 Cynefin 語意域分析，展開隱含複雜度。
避免「需求寫得很簡單，做到一半才發現很複雜」的情況。

## 輸入

- `requirement_spec_iter-X.md`（Task-Pipe 路線）
- `enhanced_draft.md`（Blueprint 路線）

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
  "iteration": "iter-1",
  "docQuality": {
    "clarity": 4,
    "completeness": 3,
    "testability": 4,
    "consistency": 5,
    "feasibility": 4,
    "total": 20,
    "verdict": "PASS",
    "weakPoints": ["completeness: 缺少錯誤處理描述"]
  },
  "modules": [
    {
      "name": "模組名稱",
      "domain": "Clear|Complicated|Complex",
      "reasoning": "判定理由（一句話）",
      "hiddenSteps": ["展開的隱含步驟1", "展開的隱含步驟2"],
      "actionCount": 3,
      "budgetOk": true
    }
  ],
  "verdict": "PASS|NEEDS_FIX",
  "issues": ["超出預算的模組或需要拆分的項目"]
}
```

---

## 完成後

執行以下指令寫入 log：

```bash
node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=<project> --iter=<N>
```

log 寫入成功後才算 `@PASS`，loop 才會放行進入 **CONTRACT** 節點。

> ⚠️ Blueprint 路線：CYNEFIN-CHECK @PASS 後的下一步是 **CONTRACT**（推導型別邊界），不是直接 PLAN。
> CONTRACT @PASS 後才進 PLAN（draft-to-plan）。
>
> Task-Pipe 路線：CYNEFIN-CHECK @PASS 後直接進 PLAN Step 1。
