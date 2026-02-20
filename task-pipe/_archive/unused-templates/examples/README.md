# 📚 GEMS 黃金範例庫

此目錄包含經過驗證的高品質範例，供 AI 在產出 POC 和 Requirement Spec 時參考。

---

## 🎯 使用目的

**問題**: AI 容易產出「最小可通過驗證」的骨架內容

**解決**: 提供完整、高品質的黃金範例作為參照標準

---

## 📂 目錄結構

```
templates/examples/
├── poc/
│   └── TaskManagerPOC_GOLD.html    # POC 完整可運行範例
├── spec/
│   └── requirement_spec_GOLD.md    # 需求規格書完整範例
└── README.md                       # 本說明文件
```

---

## 🏆 POC 黃金範例重點

**檔案**: `poc/TaskManagerPOC_GOLD.html`

### 必備元素
1. **@GEMS-DESIGN-BRIEF**: 包含 Purpose, Aesthetic, Avoid, Memorable
2. **@GEMS-VERIFIED**: 明確列出已驗證 `[x]` 和延期 `[ ]` 功能
3. **@GEMS-STORY**: 對應的 Story ID
4. **@GEMS-CONTRACT-REF**: 資料契約檔案參照

### 品質標準
- ✅ **可直接運行**: 雙擊 HTML 即可在瀏覽器開啟並使用
- ✅ **完整 CSS 設計系統**: 使用 CSS 變數，有 hover/focus 狀態
- ✅ **真實業務邏輯**: 每個函式都有可執行的程式碼，非空殼
- ✅ **輸入驗證**: 包含邊界條件處理（空值、長度、重複）
- ✅ **錯誤處理**: 有 try-catch 和使用者友善的錯誤訊息
- ✅ **Mock 資料**: 至少 3 筆，涵蓋不同狀態

### 範例註解格式
```html
// @GEMS-FUNCTION: addTask | P0 | Story-1.1
// GEMS-FLOW: ValidateInput → CreateEntity → SaveData → RefreshUI
function addTask() {
  // 真實驗證邏輯
  if (!title) {
    showError('任務名稱不可為空');
    return;
  }
  // ... 完整實作
}
```

---

## 📋 Requirement Spec 黃金範例重點

**檔案**: `spec/requirement_spec_GOLD.md`

### 必備區塊
1. **範疇聲明**: 明確列出已驗證和 DEFERRED 功能
2. **用戶故事**: 每個 Story 有具體角色、功能、目標
3. **資料契約**: 完整欄位表格，含型別、約束、說明
4. **驗收標準**: 每個 AC 有多個 Gherkin 場景
5. **獨立可測性**: 清楚標註可測與不可測項目

### 品質標準

#### 用戶故事
```markdown
❌ 錯誤範例
作為 {角色}，我想要 {功能}，以便於 {目標}。

✅ 正確範例
作為 個人開發者，我想要 能夠新增、查看、刪除任務，
以便於 快速記錄並管理我的待辦事項。
```

#### 驗收標準
```markdown
❌ 錯誤範例
Given {前置條件}
When {操作}
Then {預期結果}

✅ 正確範例
Given 任務輸入框為空
And 目前有 2 筆任務
When 使用者輸入「撰寫單元測試」
And 點擊新增按鈕
Then 任務列表應顯示 3 筆任務
And 第一筆任務標題應為「撰寫單元測試」
```

#### 每個 AC 應包含的場景類型
1. **Happy Path**: 正常成功流程
2. **Validation Failure**: 輸入驗證失敗
3. **Edge Case**: 邊界條件（空值、上限、重複）

---

## 🔧 整合到 Step 腳本

### Step 2 (POC 產出)
```javascript
const goldExamplePath = path.join(__dirname, 
  '../../templates/examples/poc/TaskManagerPOC_GOLD.html');

anchorOutput({
  guide: {
    title: 'GOLD_STANDARD',
    content: `請參考黃金範例: ${goldExamplePath}
              
品質要求:
1. 必須有真實的 @GEMS-VERIFIED 列表
2. 每個 @GEMS-FUNCTION 必須有可執行邏輯
3. Mock 資料至少 3 筆，涵蓋邊界情況
4. 必須有 CSS 設計系統與錯誤處理`
  }
});
```

### Step 3 (Spec 產出)
```javascript
const goldSpecPath = path.join(__dirname, 
  '../../templates/examples/spec/requirement_spec_GOLD.md');

anchorOutput({
  guide: {
    title: 'GOLD_STANDARD',
    content: `禁止只填骨架！請參考: ${goldSpecPath}
              
品質要求:
✅ 每個 Story 必須有具體角色（如「個人開發者」）
✅ 每個 AC 必須有至少 2 個 Gherkin 場景
✅ Given/When/Then 必須使用真實情境描述
✅ 資料契約必須有完整欄位表格`
  }
});
```

---

## 📊 品質評分對照

| 層級 | 分數 | 說明 |
|------|------|------|
| **SKELETON** | 0-49 | 只有佔位符，無實質內容 → **BLOCKER** |
| **POOR** | 50-79 | 有部分內容但不完整 → 警告 |
| **GOOD** | 80-100 | 符合黃金範例標準 → **PASS** |

---

## 🚀 擴展指南

### 新增其他領域範例
如果需要其他領域的範例（如電商、問答系統），請：

1. 在 `poc/` 新增 `{Domain}POC_GOLD.html`
2. 在 `spec/` 新增 `requirement_spec_{Domain}_GOLD.md`
3. 確保範例符合上述品質標準
4. 更新本 README

---

**版本**: 1.0.0 | **建立日期**: 2026-01-13 | **維護者**: Task-Pipe Team
