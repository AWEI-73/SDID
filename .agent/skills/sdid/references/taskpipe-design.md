# Task-Pipe 設計模式 — Draft 直入主流程

## 概覽

Task-Pipe 是需求明確時的直接入口。
不需要 Blueprint 5 輪對話，直接建立 `draft_iter-N.md` 進入主流程。

適用：
- 需求明確（知道要做什麼、有實體/操作/使用者）
- 局部功能開發或新迭代
- 使用者說「快速建」「練習」「小專案」

---

## 流程

```
draft_iter-N.md
  └── design-review skill（Draft gate）
        ↓ @PASS
  contract_iter-N.ts（AI 從 draft 推導，加入 @TEST 路徑）
    └── design-review skill（Contract gate）→ contract-gate.cjs
          ↓ @PASS
  spec-to-plan → implementation_plan_Story-X.Y.md
          ↓
  BUILD Phase 1-4（task-pipe/runner.cjs）
          ↓ 所有 Story @PASS
  SCAN → functions.json
```

---

## 執行步驟

### Step 1 — 建立 draft

```
.gems/design/draft_iter-N.md
```

若無現有 draft，引導使用者用一句話描述需求，然後直接建立 draft 檔案。
需求已夠清楚 → 直接寫 draft，不需確認。

**draft 必填欄位：**
- 功能名稱
- 實體定義（@GEMS-ENTITY / @GEMS-TABLE）
- Story 列表（@GEMS-STORY）
- API / FUNCTION 邊界（@GEMS-API / @GEMS-FUNCTION）

### Step 2 — 進入主流程

draft 建立後**不等待確認**，自動進入：

```
design-review → CONTRACT → spec-to-plan → BUILD → SCAN
```

---

## 檔案路徑規則

| 產物 | 路徑 |
|------|------|
| draft | `.gems/design/draft_iter-N.md` |
| contract | `.gems/iterations/iter-N/contract_iter-N.ts` |
| implementation_plan | `.gems/iterations/iter-N/plan/implementation_plan_Story-X.Y.md` |
| build logs | `.gems/iterations/iter-N/logs/` |

---

## 與 Blueprint 的差異

| | Blueprint | Task-Pipe |
|--|-----------|-----------|
| 適用 | 需求模糊，需要探索 | 需求明確，直接開發 |
| 入口 | 5 輪對話 → blueprint.md → draft | 直接建 draft |
| 前置設計 | 有（藍圖設計） | 無 |
| 流程 | 相同主流程 | 相同主流程 |
