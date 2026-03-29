# Gate: Draft BLOCKER 規則

適用階段：`draft_iter-N.md` 完成後，CYNEFIN-CHECK 前

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

## 通過條件

以上四條全部未觸發 → @PASS，進入 CYNEFIN-CHECK
