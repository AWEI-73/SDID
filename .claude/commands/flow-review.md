---
name: flow-review
description: FLOW 審查與 CYNEFIN 節點分析。只在使用者明確說「REVIEW FLOW」「FLOW 審查」「CYNEFIN 分析」「這個 FLOW 對嗎」「驗證 FLOW」時觸發。不自動觸發。觸發時先讀 blueprint 的「複雜度標註」section 作為 domain 上下文，再做節點層級審查。輸出：改寫的 FLOW（含域標記）+ @GEMS-WHY + POC 觸發清單，直接可貼回 contract.ts。
---

# FLOW-REVIEW — CYNEFIN 節點審查

> 輸入：FLOW 字串 + 業務描述（從 draft 或使用者說明取得）
> 上下文：blueprint `### 複雜度標註` section 的 domain 分類（先讀，作為節點分類的參考基準）
> 輸出：標記過的 FLOW + @GEMS-WHY + POC 清單，全部落在 contract 格式內

---

## 前置：讀 Blueprint 複雜度標註

觸發後先確認 blueprint 是否有 `### 複雜度標註（CYNEFIN 回填）` section：

- **有**：讀取該 iter 的 `Domain` 欄，作為此次 FLOW 節點分類的參考基準。
  例如 iter 標記為 `Complicated`，則節點傾向 Complicated/Clear，除非有明確 Complex 特徵。
- **沒有**：繼續執行，但在輸出末尾加 `⚠ blueprint 缺少複雜度標註，請在 CYNEFIN-CHECK 後回填 ### 複雜度標註 section`。

---

## 執行步驟

### Step 1 — 解析節點

把 FLOW 拆成獨立節點，列出每個節點名稱。

```
VALIDATE → QUERY → TRANSFORM → NOTIFY → RETURN
→ [VALIDATE] [QUERY] [TRANSFORM] [NOTIFY] [RETURN]
```

---

### Step 2 — 原子性檢查

每個節點問三個問題：

| 問題 | 如果是 → |
|------|---------|
| 節點名稱含 AND / + / 及 / 和？ | 複合，拆分 |
| 這個節點做了超過一件事？ | 複合，拆分 |
| 用一句話說不清楚這個節點的 WHY？ | 複合，拆分 |

拆分規則：`VALIDATE_AND_LOG` → `VALIDATE` + `LOG`

---

### Step 3 — CYNEFIN 域分類

> 完整域定義與三問判斷法讀 [references/cynefin-check.md](references/cynefin-check.md) Phase 1。
> 此處只列標記格式。

| 域 | 標記 |
|----|------|
| Clear | `(Clear)` |
| Complicated | `(Complicated)` |
| Complex | `★Complex` |
| Chaotic | `⚠CHAOTIC` — 停止，回報使用者 |

> **判斷捷徑**：「如果外部條件改變，這個節點的行為會不一樣嗎？」→ 是 → Complex

---

### Step 4 — 語意句驗證

用一段白話把整個 FLOW 的意圖說清楚：

```
「這個函式 [接收什麼]，先 [第一件事，為什麼]，
 然後 [第二件事，為什麼]，...，最後 [回傳什麼]。
 失敗情境：[條件] → [回應]。」
```

語意句寫不出來 = FLOW 有問題，先修 FLOW 再繼續。
語意句有邏輯漏洞（缺失敗處理、漏依賴）= 補進 FLOW。

---

### Step 5 — 壓縮成 @GEMS-WHY

從語意句提取關鍵資訊，壓縮格式：

```
goal=[函式目標] | guard=[前置條件/驗證邏輯] | [關鍵技術決策] | fail=[錯誤碼(原因)]
```

有 Complex 節點時加 `★POC-first=[節點名](原因)`：

```
goal=建帳號 | guard=email唯一+role合法 | security=bcrypt | fail=409(重複),400(role無效)
```

```
goal=推播通知 | ★POC-first=NOTIFY(外部推播行為不可預測) | fail=log+continue(不中斷主流)
```

---

## 輸出格式

直接輸出可貼回 contract.ts 的格式：

```ts
// @GEMS-STORY-ITEM: {techName} | {TYPE} | P{N} | VALIDATE(Clear)→QUERY(Complicated)→[NOTIFY★Complex]→RETURN(Clear) | [{DEPS}]
// @GEMS-WHY: goal=... | guard=... | fail=... | ★POC-first=NOTIFY(原因)
```

---

## 多節點 Complex 警告

同一個 FLOW 出現 2+ 個 ★Complex 節點：

```
⚠ FLOW 複雜度過高：2 個 Complex 節點（NOTIFY + SYNC）
建議：拆成兩個 STORY-ITEM
  Story-X.1 | 主流程（不含外部依賴）
  Story-X.2 | 外部整合（POC-first）
```

---

## Chaotic 節點處理

出現 ⚠CHAOTIC 節點時停止，回報使用者：

```
⚠ CHAOTIC 節點：[節點名]
這個節點的行為目前無法設計（[原因]）。
建議先釐清這個業務規則再繼續。
```

---

## 完整範例

**輸入：**
```
FLOW: VALIDATE_AND_CHECK_PERM → QUERY → CALC → RETURN
業務描述：計算用戶本月的碳排放總量，只有 admin 可以查
```

**Step 2 拆分：**
```
VALIDATE_AND_CHECK_PERM → [VALIDATE] + [CHECK_PERM]
→ VALIDATE → CHECK_PERM → QUERY → CALC → RETURN
```

**Step 3 分類：**
```
VALIDATE(Clear) → CHECK_PERM(Clear) → QUERY(Complicated) → CALC(Complicated) → RETURN(Clear)
```

**Step 4 語意句：**
```
「接收月份參數，先驗格式（YYYY-MM），再確認呼叫者是 admin，
 從 DB 取該月所有排放記錄，計算 CO2e 加總，回傳 MonthlySummary。
 失敗：格式錯 → 400，非 admin → 403，無資料 → 回傳 { total: 0 }。」
```

**Step 5 輸出：**
```ts
// @GEMS-STORY-ITEM: calcMonthlyEmission | CALC | P1 | VALIDATE(Clear)→CHECK_PERM(Clear)→QUERY(Complicated)→CALC(Complicated)→RETURN(Clear) | [CoreTypes,AuthService]
// @GEMS-WHY: goal=計算月碳排 | guard=格式YYYY-MM+role=admin | calc=CO2e加總 | fail=400(格式),403(權限),noData={total:0}
```
