# Design Review — 全域說明

## 什麼叫「Design Review」

SDID 的設計產物在進入下一階段前必須通過品質審查。
審查分兩種性質，由不同工具負責：

| 性質 | 工具 | 輸出 |
|------|------|------|
| **語意審查**（需要理解內容） | design-review skill（本 skill） | @PASS / @NEEDS_FIX |
| **機械審查**（格式、語法、計數） | contract-gate.cjs / blueprint-gate.cjs | @PASS / @BLOCKER |
| **FLOW 語意改寫** | flow-review skill | 改寫後的 FLOW + @GEMS-WHY |

---

## 各工具審查什麼

### design-review skill（語意層）

| 階段 | 審查重點 |
|------|---------|
| Blueprint R4 | 垂直切片完整性、Demo Checkpoint 可觀察性、Foundation 職責、Budget 預判 |
| Blueprint R5 | R4 全部 ＋ P0 行為規格存在性、Then 效益語意、Story 數量 |
| Draft | Tag 存在性、Then 效益語意、Entity 引用完整性、P0 行為規格非空 |
| Contract | @GEMS-TDD 路徑有效性、型別具體性、P0 錯誤情境、命名一致性、@GEMS-WHY 意義 |

### contract-gate.cjs（機械層，Contract 專用）

| 檢查項 | 機制 |
|--------|------|
| TypeScript 編譯 | tsc --noEmit |
| @GEMS-* tag 格式 | gems-scanner regex |
| @GEMS-TDD 路徑格式 | 字串比對（src/ + .test.ts） |
| interface 宣告存在 | AST 掃描 |

### blueprint-gate.cjs（機械層，Blueprint 專用）

| 檢查項 | 機制 |
|--------|------|
| Action Budget 數字 | 計數比對 |
| 垂直切片層數 | 關鍵字比對 |
| Demo Checkpoint 存在 | 區塊偵測 |

### flow-review skill（語意改寫，非 gate）

- 不是 gate，不擋關
- 在 Contract 語意擴充期間使用
- 輸出：CYNEFIN 域標記的 FLOW + @GEMS-WHY，直接貼回 contract.ts

---

## 評分機制

**統一原則：只有兩種結果，沒有分數，沒有 WARN**

```
@PASS        ← 全部 BLOCKER 條件未觸發，直接進下一步
@NEEDS_FIX   ← 任一 BLOCKER 觸發，列清單，重寫後重跑
```

**機械 gate 使用相同輸出語言：**

```
@PASS    ← contract-gate.cjs / blueprint-gate.cjs 通過
@BLOCKER ← 機械錯誤（tsc 失敗、tag 格式錯、計數超標）
```

> `@BLOCKER`（機械）= `@NEEDS_FIX`（語意）= 都是擋關，語言略有區別只因工具不同。

---

## Pipeline 序列（語意 → 機械，依序執行）

```
Blueprint R4 完成
  └─ [design-review] @PASS → R5

Blueprint R5 完成
  └─ [design-review] @PASS
       └─ [blueprint-gate.cjs] @PASS → Draft 組裝

Draft 完成
  └─ [design-review] @PASS → CYNEFIN-CHECK

Contract AI 語意擴充完成
  └─ [flow-review]（選用，補 @GEMS-WHY）
  └─ [design-review] @PASS
       └─ [contract-gate.cjs] @PASS → spec-to-plan → BUILD
```

**原則：語意 gate 先跑，機械 gate 後跑。**
語意有問題 → 不浪費機械驗證的時間。

---

## 責任分界

| 檢查 | design-review skill | 機械 gate |
|------|--------------------|-----------|
| Then 是效益還是技術動詞 | ✅ | ✗ 無法判斷 |
| Entity 命名一致性（語意比對） | ✅ | ✗ |
| @GEMS-WHY 是否有業務意圖 | ✅ | ✗ |
| P0 錯誤情境說明是否充分 | ✅ | ✗ |
| tsc 編譯是否通過 | ✗ 不做 | ✅ |
| @GEMS-TDD 路徑格式 | 語意判斷路徑合理性 | ✅ 格式比對 |
| Action Budget 計數 | R4 預判（早期警示） | ✅ 精確計數 |

**不重複**：同一件事不同工具做兩次是浪費。
設計意圖是「語意先篩，機械後確認」，各司其職。

---

## 重試上限（全局一致）

所有 gate（語意或機械）的重試上限均為 **2 次**。

```
第 1 次 @NEEDS_FIX / @BLOCKER → 重寫 artifact → 再跑
第 2 次仍失敗 → 停止，回報使用者，需要人工介入
```
