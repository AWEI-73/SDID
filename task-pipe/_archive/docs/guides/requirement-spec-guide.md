# 需求規格書撰寫指南 (Requirement Spec Guide)

**版本**: v1.0  
**日期**: 2025-12-08  
**適用階段**: 專案啟動、需求定義

> 📚 **相關文件**:  
> - [專案技術規格書指南](./project-spec-guide.md) - 技術實作規格  
> - [GEMS 標籤完整指南](./gems-tagging-complete-guide.md) - 代碼標籤規範

---

## 1. 文件定位

需求規格書（PRD Lite）是專案的「需求藍圖」，用於：
- 定義專案要解決的問題
- 列出功能模組和用戶故事
- 建立驗收標準
- 作為 AI 開發的輸入依據

---

## 2. 核心結構

### 2.1 專案摘要

| 項目 | 內容 |
|------|------|
| **痛點** | 目前遇到了什麼困難？ |
| **解決方案** | 我們打算用什麼方式解決？ |
| **本次迭代範圍** | 這次要做的核心功能 (MVP) |
| **不做什麼** | 明確排除，避免發散 |

### 2.2 功能模組清單

每個模組使用 Story 格式：

```markdown
### Story-X.1: 模組中文名稱 (`module-id`)

| 項目 | 內容 |
|------|------|
| **模組 ID** | `module-id` ← 對應 Full_Project_Spec 模組名 |
| **關聯 Schema** | `tbl_table_name` ← 對應資料庫表 |
| **優先級** | P0 🔴 / P1 🟡 / P2 🟢 |

**用戶故事**: 作為 {角色}，我想要 {做什麼}，以便於 {達成目的}。

**核心邏輯**:
1. 邏輯步驟 1
2. 邏輯步驟 2
3. 異常處理邏輯

**必要資料欄位**:
| 欄位 | DB 欄位名 | 必填 | 業務規則 |
|------|-----------|------|----------|
| 中文名稱 | `db_column` | ✅ | 格式、長度、產生規則 |
```

### 2.3 驗收標準 (BDD 格式)

```gherkin
### AC-1: 驗收名稱 → Story-X.X

Given {前置條件}
When {操作動作}
Then {預期結果}

**測試類型**: ✓ Unit | ✓ Integration | - E2E
```

### 2.4 追溯矩陣

| Story ID | 模組 ID | 資料表 | P0 函式 | 驗收標準 |
|----------|---------|--------|---------|----------|
| Story-X.1 | `module-id` | `tbl_table` | `funcName` | AC-1, AC-2 |

---

## 3. 命名規則

| 項目 | 格式 | 範例 |
|------|------|------|
| Story ID | `Story-X.X` | `Story-14.1` |
| 模組 ID | kebab-case | `meal-management` |
| 資料表 | snake_case + `tbl_` 前綴 | `tbl_meal_log` |
| 驗收標準 | `AC-X` | `AC-1`, `AC-NFR` |

---

## 4. 與 GEMS Flow 的關係

```
需求規格書 (Requirement Spec)
    ↓
PLAN 階段：產出 implementation_plan_[X].md
    ↓
BUILD 階段：開發 + 標籤
    ↓
SCAN 階段：產出 Full_Project_Spec.json
```

需求規格書中的 Story ID 會對應到：
- GEMS 標籤的 `Story-X.X` 欄位
- Implementation Plan 的 Item
- Full_Project_Spec 的函式關聯

---

## 5. 範本

完整填空範本請參考：[requirement_spec.template.md](../templates/requirement_spec.template.md)

---

**文件版本**: v1.0 | **產出日期**: 2025-12-08
