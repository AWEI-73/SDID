# PLAN Step 2 檢查清單

> 🎯 **目標**: 確保 implementation_plan 能通過 Step 2 驗證

## ✅ 必要元素檢查

### 1. Story 目標 ⭐ 必須

```markdown
## 1. Story 目標

**一句話目標**: [清楚描述本次 Story 要達成什麼]

**範圍**:
- ✅ 包含: [功能 A], [功能 B]
- ❌ 不包含: [功能 C]
```

**驗證關鍵字**: `Story 目標` 或 `一句話目標`

---

### 2. 工作項目表格 ⭐ 必須

```markdown
## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | [Item 名稱] | FEATURE | P0 | ✅ 明確 | 2-3h |
| 2 | [Item 名稱] | QUALITY | P1 | ✅ 明確 | 1-2h |

**執行順序**: Item 1 → Item 2
```


**驗證關鍵字**: `工作項目` 或 Markdown 表格（包含 `Item` 欄位）

**Type 選項**: FEATURE | QUALITY | BUGFIX | REFACTOR | INTEGRATION  
**Priority 選項**: P0 | P1 | P2 | P3

#### ⚠️ 路由整合 Item (X.1+ 強制)

對於 **Story X.1+** (業務模組)，工作項目表格**必須包含**「路由整合」Item：

```markdown
| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| N | 路由整合 | INTEGRATION | P1 | ✅ 明確 | 15m |

### Item N: 路由整合
**GEMS-FLOW**: Import→Register→Verify
**實作邏輯**:
1. 在 `routes.config.ts` 或 `App.tsx` import 新模組頁面
2. 新增 Route 定義 (path, component)
3. 更新 BottomNav/SideNav 導航項目
4. 啟動應用驗證可訪問

**驗收標準**:
- [ ] URL 可訪問新頁面
- [ ] 導航元件可正確跳轉
```

> **為什麼強制？** 避免模組開發完成後「孤立存在」，沒有實際連接到應用程式。


---

### 3. 規格注入 ⭐ 必須

```markdown
## 5. 規格注入

### 5.1 資料契約 (@GEMS-CONTRACT)

\`\`\`typescript
// @GEMS-STORY: Story-X.Y
// @GEMS-CONTRACT: EntityName
// @GEMS-TABLE: tbl_table_name
interface EntityName {
  id: string;           // UUID, PK
  fieldName: string;    // VARCHAR(100), NOT NULL
  status: EntityStatus; // ENUM('DRAFT','ACTIVE')
}
\`\`\`

### 5.2 核心函式規格

\`\`\`typescript
// @GEMS-FUNCTION: functionName
// @GEMS-SIGNATURE: (input: InputType) → Promise<OutputType>
// @GEMS-PRIORITY: P0
// @GEMS-FLOW: Step1→Step2→Step3
\`\`\`
```

**驗證關鍵字**: `@GEMS-CONTRACT` 或 `規格注入` 或 `interface`

---

## 🚨 常見錯誤

### ❌ 錯誤 1: 缺少「一句話目標」

```markdown
## 1. 概述
建立專案基礎架構...
```

**問題**: 使用「概述」而非「Story 目標」，且缺少「一句話目標」關鍵字

**修正**:
```markdown
## 1. Story 目標

**一句話目標**: 建立專案基礎架構...
```

---

### ❌ 錯誤 2: 工作項目不是表格格式

```markdown
## 3. 詳細規格

### [STEP] 建立專案結構
- 建立 src 目錄
- 建立 index.html
```

**問題**: 使用列表而非表格，缺少 Type 和 Priority

**修正**:
```markdown
## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | 建立專案結構 | FEATURE | P0 | ✅ 明確 | 1h |
```

---

### ❌ 錯誤 3: 缺少規格注入

```markdown
## 4. 驗證計畫
- [ ] 專案可於瀏覽器開啟
```

**問題**: 完全沒有「規格注入」區塊

**修正**: 必須加入 Section 5，包含 `@GEMS-CONTRACT` 和函式規格

---

## 📋 快速驗證指令

```bash
# 驗證 PLAN Step 2
node task-pipe/runner.cjs --phase=PLAN --step=2 --target=[project-name] --story=Story-X.Y
```

**通過標準**: 輸出 `[PASS] Phase completed successfully`

---

## 🎯 最佳實踐

### 1. 使用完整模板

**推薦**: 直接複製 `control-tower/docs/templates/implementation_plan.template.md`

```bash
# 複製模板
cp control-tower/docs/templates/implementation_plan.template.md \
   [project]/.gems/iterations/iter-X/plan/implementation_plan_Story-X.Y.md
```

### 2. 參考成功範例

**範例位置**:
- `calculator-app/.gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md`
- `control-tower/docs/examples/implementation_plan_Story-1.0_example.md`

**策略**: 「像素級」模仿成功範例的格式

### 3. 從 POC 注入契約

**如果有 POC 產出**:
1. 讀取 `[project]/.gems/iterations/iter-X/poc/requirement_spec_iter-X.md`
2. 讀取 `[project]/.gems/iterations/iter-X/poc/[Name]Contract.ts`
3. 將契約內容完整複製到 Section 5.1

**核心原則**: `@GEMS-CONTRACT` 是 POC → BUILD 的橋樑，不能省略

---

## 🔍 除錯技巧

### 如果 Runner 報錯不清楚

1. **檢查語法錯誤**: 確保沒有重複的 import 或語法錯誤
2. **手動驗證關鍵字**: 在文件中搜尋「Story 目標」、「工作項目」、「@GEMS-CONTRACT」
3. **對比成功範例**: 使用 diff 工具比較格式差異
4. **查看驗證邏輯**: 閱讀 `task-pipe/phases/plan/step-2.cjs` 的 `validateStep2()` 函式

### 驗證邏輯（供參考）

```javascript
function validateStep2(content) {
  return [
    { name: 'Story 目標', pass: /Story 目標|一句話目標/i.test(content) },
    { name: '工作項目', pass: /工作項目|Item.*\|/i.test(content) },
    { name: '規格注入', pass: /@GEMS-CONTRACT|規格注入|interface/i.test(content) },
  ];
}
```

---

## 📚 相關文檔

- [Implementation Plan 模板](../control-tower/docs/templates/implementation_plan.template.md)
- [GEMS Flow 指南](../.kiro/steering/gems-flow.md)
- [Story 編號指南](../control-tower/docs/guides/story-numbering-guide.md)
- [改善日誌](./IMPROVEMENT_LOG_2026-01-08.md)

---

**最後更新**: 2026-01-08  
**維護者**: GEMS Flow Team
