# Design Review Skill

## 描述

SDID 設計產物品質審查。接受 Blueprint / Draft / Contract 任一 artifact，
自動偵測階段並執行對應 BLOCKER 規則。結果只有兩種：@PASS 或 @NEEDS_FIX。

## 觸發語

- "DESIGN REVIEW"
- "design-review"
- "review 這個 draft / blueprint / contract"
- "幫我 review [artifact]"
- "跑 gate"
- "design gate"
- "這個 draft / blueprint / contract 過了嗎"

## 不觸發

- FLOW 審查 → 使用 `flow-review` skill
- BUILD 階段問題 → 使用 `sdid` skill
- 純問答，未提供 artifact

---

## 執行流程

### Step 1：偵測 artifact 類型

| 檔名模式 | 階段 | 載入規則 |
|---------|------|---------|
| `blueprint_iter-N.md` | Blueprint R4 或 R5 | references/gate-blueprint.md |
| `draft_iter-N.md` | Draft | references/gate-draft.md |
| `contract_iter-N.ts` | Contract | references/gate-contract.md |

若使用者直接貼內容未提供檔名，依內容特徵判斷：
- 含 `@GEMS-STORY-ITEM` + `FLOW:` → Contract
- 含 `Given / When / Then` 段落且為 Markdown → Draft
- 含 `iter-` 規劃表格 + `Demo Checkpoint` → Blueprint

### Step 2：載入對應 gate reference，逐條比對 BLOCKER 條件

### Step 3：輸出

**全部通過：**
```
## Design Review — [artifact name]

@PASS
```

**有 BLOCKER：**
```
## Design Review — [artifact name]

❌ BLOCKER (N)
  - [RULE-ID] 說明（含具體位置）
  - [RULE-ID] 說明

@NEEDS_FIX — 重寫 [artifact name] 後再跑 design-review
```

---

## 重試上限

最多重寫 **2 次**仍 @NEEDS_FIX → 停止，回報：
>「[artifact] 連續兩次未通過 design-review，需要人工介入」

---

## 與 SDID 流程的銜接點

```
Blueprint R4 完成 → design-review → @PASS → R5
Blueprint R5 完成 → design-review → @PASS → Draft 組裝
Draft 完成        → design-review → @PASS → Draft Gate
Contract 完成     → design-review → @PASS → contract-gate.cjs（機械驗證）
```

---

## 參考文件

| 文件 | 說明 |
|------|------|
| references/review-overview.md | 全域說明：審查範圍、評分機制、pipeline 序列、責任分界 |
| references/gate-blueprint.md | Blueprint R4/R5 BLOCKER 規則 |
| references/gate-draft.md | Draft BLOCKER 規則 |
| references/gate-contract.md | Contract BLOCKER 規則 |

**與其他工具的關係（詳見 review-overview.md）：**
- `contract-gate.cjs` — 機械審查（tsc、tag 格式），在本 skill @PASS 後才跑
- `blueprint-gate.cjs` — 機械審查（Budget 計數），在 Blueprint R5 design-review @PASS 後才跑
- `flow-review` skill — FLOW 語意改寫 + @GEMS-WHY，非 gate，選用

**已廢棄（整合進本 skill）：**
- `sdid/references/design-quality-gate.md` → 改用本 skill
- `sdid/references/design-reviewer-prompt.md` → 整合進 gate-contract.md
