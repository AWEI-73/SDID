# 📋 迭代 N: 用餐管理 CRUD (需求規格) — Skill A 輸入樣板 · Task-Pipe 路線

> **此文件是 Skill A 的輸入**：Task-Pipe scaffold 5步產物
> Skill A 讀「Section 5 模組動作清單表」→ 產出 `.gems/specs/meal-service.json`

---

## 5. 模組動作清單表 (Function Scope)

**注意：這裡定義的所有函式必須和開發階段實際建立的 @GEMS-FUNCTION 一致。**

| Story | 模組動作名稱 | Type | Prio | 流程 (GEMS-FLOW 簡述) | 功能描述 |
|-------|------------|------|------|---------------------|---------|
| N.0 | AddMeal | FUNC | P0 | ValidateInput→CheckUser→Insert→Return | 新增一筆用餐紀錄 |
| N.0 | ListMeals | FUNC | P0 | ParseQuery→FetchRows→Transform→Return | 查詢用餐列表，支援分頁 |
| N.1 | DeleteMeal | FUNC | P1 | AuthorizeOwner→SoftDelete→Return | 軟刪除用餐紀錄（需驗權） |

---

## 6. 驗收標準

### AC-N.0: 新增用餐
- Given 有效的用餐資料
- When AddMeal(data)
- Then 資料庫新增一筆，回傳 id

### AC-N.0: 查詢列表
- Given 合法的 userId
- When ListMeals({ userId, page })
- Then 回傳該使用者的分頁用餐列表
