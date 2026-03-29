# Gate: Blueprint BLOCKER 規則

適用階段：Blueprint R4 / R5

---

## 如何判斷是 R4 還是 R5

- **R4**：只有迭代規劃表格（iter 分配、action 列表、Demo Checkpoint），**尚未有**行為規格
- **R5**：每個 action 已展開 Given/When/Then 行為規格

R5 在 R4 規則基礎上**追加**語意規則。

---

## R4 BLOCKER 條件

### B-R4-01：垂直切片不完整
**條件**：任何功能性 iter 缺少 SVC / ROUTE / UI 任一層
**判斷**：功能性 iter（非 Foundation）必須包含至少 SVC + ROUTE + UI 三層 action
**範例違規**：`iter-2 只有 createClass(SVC)，缺 /api/class(ROUTE) + ClassPage(UI)`

### B-R4-02：Demo Checkpoint 不可觀察
**條件**：Checkpoint 描述無法親眼驗證
**判斷**：含以下模糊詞 → BLOCKER
黑名單：`系統完成 / 初始化完成 / 資料已就緒 / 後端處理完成 / 操作完成`
**範例違規**：`Demo: 系統完成課程初始化`
**合格範例**：`Demo: 點擊「新增課程」→ 表單出現 → 填寫送出 → 列表顯示新課程`

### B-R4-03：Action Budget 超標
**條件**：任何 iter 的 action 數超過層級上限

| 層級 | 上限 | 判斷依據 |
|------|------|---------|
| Level S（Foundation） | 2 | action 總數 |
| Level M（一般功能 iter） | 4 | action 總數 |
| Level L（複雜 iter） | 6 | 需明確標記 Level L |

**範例違規**：`iter-3（Level M）有 5 個 action`

### B-R4-04：Foundation 含業務邏輯
**條件**：Foundation iter 含 Service 實作、業務計算、Mock 資料邏輯
**合法的 Foundation 內容**：DB schema、型別定義、環境設定、外部連線初始化
**範例違規**：`Foundation 含 createUser(SVC)、mockUsers 資料`

---

## R5 追加 BLOCKER 條件（R4 全部繼承）

### B-R5-01：P0 Action 缺行為規格
**條件**：任何 P0 優先級 action 沒有 Given/When/Then 行為規格
**範例違規**：`createTrainingSession (P0) — Given/When/Then: 待補`

### B-R5-02：Then 使用技術動詞黑名單
**條件**：Then 描述含以下詞彙

```
黑名單：解析完成 / 回傳結果 / 寫入成功 / 系統記錄 /
        操作完成 / 資料已儲存 / 初始化 / 處理完成 / 執行完畢
```

**範例違規**：`Then: 資料寫入成功`
**合格範例**：`Then: 使用者在列表看到新增的訓練項目，可立即點入查看詳情`

### B-R5-03：功能性 iter 少於 2 個 Story
**條件**：功能性 iter（非 Foundation）只有 1 個 Story
**原因**：單 Story 代表前後端沒有拆分，垂直切片不完整
**範例違規**：`iter-2 只有 Story-0（後端），缺 Story-1（前端串接）`
