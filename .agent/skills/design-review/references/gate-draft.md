# Gate: Draft BLOCKER 規則

適用階段：`draft_iter-N.md` 完成後，Draft Gate 前

---

## BLOCKER 條件

### B-DRAFT-01：動作清單結構缺失
**條件**：缺少以下任一必要結構

```
## 動作清單（含表格）
## Story 拆法（含 > Story-X.Y 描述）
```

**判斷**：掃描 draft 全文，缺任一 → BLOCKER
**範例違規**：`整份 draft 沒有 ## 動作清單 表格`

---

### B-DRAFT-02：Then 使用技術動詞黑名單
**條件**：任何行為規格的 Then 描述含以下詞彙

```
黑名單：解析完成 / 回傳結果 / 寫入成功 / 系統記錄 /
        操作完成 / 資料已儲存 / 初始化 / 處理完成 / 執行完畢
```

**判斷**：Then 應描述**使用者可感知的效益**，不是系統行為
**範例違規**：`Then: 資料寫入成功，回傳 200`
**合格範例**：`Then: 使用者在課程列表看到剛新增的課程，可立即點入編輯`

---

### B-DRAFT-03：Entity 未定義就被引用
**條件**：STORY-ITEM 的 FLOW 或行為規格引用了某個 entity，但 draft 中無對應的 CONST/型別定義

**判斷步驟**：
1. 列出所有 STORY-ITEM 中出現的實體名稱（大寫開頭的型別名）
2. 確認 draft 中是否有對應的 `@GEMS-STORY-ITEM: [EntityName] | CONST` 定義
3. 引用了但沒定義 → BLOCKER

**範例違規**：`FLOW 出現 IUserProfile，但 draft 中無 IUserProfile CONST 定義`

---

### B-DRAFT-04：P0 Action 行為規格為空
**條件**：P0 優先級的 action 沒有 Given/When/Then 行為規格
**判斷**：`Given/When/Then: 待補` / 行為規格區塊完全缺失 → BLOCKER
**範例違規**：`createCourse (P0) — Given/When/Then 全空`

---

### B-DRAFT-05：P0/P1 UI Action 缺 UI 位階聲明
**條件**：UI 類型的 action（action 類型標記為 UI 或行為描述含「顯示」「畫面」「介面」「元件」）未聲明 UI 位階

**判斷規則**：

| 優先級 | 要求 | 不符合 |
|--------|------|--------|
| P0 UI action | 完整 UI 位階（至少兩層，含 PascalCase 組件名） | BLOCKER |
| P1 UI action | 至少一個 PascalCase 組件名或功能區域名 | WARNING（不 BLOCKER） |

**BLOCKER 合格示範（P0）**：
```
Board > Grid > MilestoneMarker > Label > MaintenancePanel
GanttRow > MilestoneStatusBadge > TooltipPanel
```

**WARNING 合格示範（P1）**：
```
MilestoneMarker 顯示狀態標籤（最低要求：有組件名）
```

**範例違規（P0 BLOCKER）**：
```
Action: 改 Gantt UI 顯示里程碑（P0）— 無任何位階聲明
Action: 更新甘特圖標記樣式（P0）— 無 PascalCase 組件名
```

---

### B-DRAFT-06：破壞性 / 持久化 UI 入口晚於 guard 或缺少 guard
**條件**：P0/P1 UI action 涉及 delete / remove / archive / destructive / save / persist 行為，但 guard / validation / confirmation / adapter 在後續 Story 才定義，或 acceptance 沒有明確說入口在 guard 前必須 disabled / delegated。

**判定規則**：

| 情境 | 結果 |
|------|------|
| UI action 建立 delete/remove/archive 入口，且直接依賴後續 Story 才有 guard | BLOCKER |
| UI action 建立 save/persist 入口，但相容 adapter / validation 在後續 Story 才定義 | BLOCKER |
| UI action 明確寫「入口 disabled until guard exists」或「delegates to GuardName」 | PASS |
| guard 與入口在同一 Story，或 guard 是前置 Story | PASS |

**正確範例**：
```
Story-12.2: ManagementTaskCrudPanel provides delete entry placeholder; delete entry is disabled or delegates to TaskDeleteGuard and never calls deleteTask directly.
Story-12.3: TaskDeleteGuard owns delete enablement and deleteTask invocation.
```

**錯誤範例（BLOCKER）**：
```
Story-12.2: Task CRUD panel includes delete button and calls deleteTask.
Story-12.3: TaskDeleteGuard prevents deleting tasks with milestones.
```

---

## 通過條件

B-DRAFT-01 ~ B-DRAFT-06 BLOCKER 全部未觸發 → @PASS，進入 Draft Gate
B-DRAFT-05 WARNING 不阻擋 @PASS，但輸出 review 時標記 ⚠️
