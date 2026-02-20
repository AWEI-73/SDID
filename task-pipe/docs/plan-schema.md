# Implementation Plan Schema v1.0

> SDID 的 ABI — 雙引擎 (task-pipe + blueprint) 產出的 Plan 必須符合此 Schema。
> 驗證器: `task-pipe/lib/plan/plan-validator.cjs`

---

## 概述

`implementation_plan_Story-X.Y.md` 是 SDID 的中間層協定。
不論從哪條路線進入 (Blueprint Flow 或 Task-Pipe Flow)，BUILD Phase 1 只看 plan 格式對不對。

```
Blueprint Flow:  Enhanced Draft → Gate → draft-to-plan.cjs → plan ──┐
                                                                     ├→ BUILD Phase 1-8
Task-Pipe Flow:  requirement_draft → POC → PLAN Step 2 → plan ─────┘
```

兩條路線的出口驗證：
- `draft-to-plan.cjs` 寫完 plan 後自動執行 plan-validator (WARNING 級)
- `step-5.cjs` 驗證 plan 時自動執行 plan-validator (WARNING 級)
- `BUILD Phase 1` 進入前執行 plan-validator (BLOCKER 級)

---

## Schema 規則

### Rule 1: H1_STORY_ID (BLOCKER)

H1 標題必須包含 `Story-X.Y` 格式。

```markdown
# Implementation Plan - Story-1.0     ✅
# Story-2.1 Implementation Plan       ✅
# Implementation Plan                 ❌ 缺少 Story ID
```

### Rule 2: STORY_ID_FIELD (BLOCKER)

必須有 `**Story ID**: Story-X.Y` 欄位，且與檔名一致。

```markdown
**Story ID**: Story-1.0               ✅ (檔名: implementation_plan_Story-1.0.md)
**Story ID**: Story-1.1               ❌ (檔名: implementation_plan_Story-1.0.md → 不一致)
```

### Rule 3: SECTION_3 — 工作項目表格 (BLOCKER)

必須有 `## 3. 工作項目` 區段，包含表格。

表格必要欄位: `Item | 名稱 | Type | Priority`

```markdown
## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | createTodo | FEATURE | P0 | ✅ 明確 | 2h |
| 2 | listTodos  | FEATURE | P1 | ✅ 明確 | 1h |
```

### Rule 4: PRIORITY_VALUE (BLOCKER)

Priority 欄位只允許: `P0`, `P1`, `P2`, `P3`

### Rule 5: SECTION_4 — Item 詳細規格 + GEMS 標籤 (BLOCKER)

必須有 `## 4. Item 詳細規格` 區段，至少一個 `### Item N` 定義。

至少一個 Item 必須包含 GEMS 標籤 (以下任一):
- `GEMS: functionName | P0 | ...`
- `@GEMS-FUNCTION: functionName`
- `@GEMS-CONTRACT: TypeName`

### Rule 6: SECTION_1 — Story 目標 (WARNING)

建議有 `## 1. Story 目標` 區段。缺少不阻擋 BUILD。

### Rule 7: FILE_REFS — 檔案路徑參考 (WARNING)

建議有檔案路徑參考 (以下任一):
- `## 5. 檔案清單` 或 `## 5. Integration` 區段
- inline `**檔案**:` 標記
- 表格中包含 `src/` 路徑

### Rule 8: SECTION_8 — 架構審查 (WARNING)

建議有 `## 8. 架構審查` 區段。缺少不阻擋 BUILD。

### Rule 9: P0_FLOW — P0 函式的 GEMS-FLOW (WARNING)

P0 優先級的函式建議有 `GEMS-FLOW:` 標籤。缺少不阻擋 BUILD。

---

## 嚴重度定義

| 級別 | 意義 | 觸發時機 |
|------|------|---------|
| BLOCKER | 必須修復才能進 BUILD | BUILD Phase 1 入口 |
| WARNING | 建議修復，不阻擋 | draft-to-plan / step-5 出口 |

---

## 驗證器 CLI

```bash
# 驗證單一 plan
node task-pipe/lib/plan/plan-validator.cjs <plan.md>

# 驗證整個 iteration 的所有 plan
node task-pipe/lib/plan/plan-validator.cjs --all --target=<project> --iteration=iter-1
```

---

## 版本歷史

| 版本 | 日期 | 變更 |
|------|------|------|
| v1.0 | 2026-02-15 | 初版，8 條規則，從 3 個真實專案的 de facto schema 提煉 |
