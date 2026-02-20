# UI 移植策略指南

## 🎯 問題描述

在 GEMS Flow 中，經常出現「邏輯通過但畫面空白」的問題：
- POC 有完整的 UI 設計
- BUILD 階段只實作了邏輯骨架
- 最終產品與 POC 視覺差異巨大

## 🔍 根本原因

1. **Implementation Plan 缺少明確的 UI 移植任務**
2. **BUILD Phase 1-7 專注於邏輯驗證，忽略視覺驗證**
3. **沒有自動化工具協助 POC → 專案的移植**

## ✅ 解決方案

### 方案 A：在 PLAN 階段強制加入 UI 移植任務（推薦）

#### Step 1: 修改 PLAN Step 4 模板

在 `control-tower/prompts/templates/plan-step-4.md` 中加入前端專案檢查：

```markdown
### 0. 前端專案特殊檢查 ⚠️

如果專案包含 UI/前端元件，必須在 Story-1.0 或第一個前端 Story 中加入：

**Item: UI 移植 (UI Migration) | P0**

目標：將 POC 的 HTML/CSS/JS 完整移植到專案中

驗收標準：
1. ✅ 所有 POC 的 HTML 結構已移植
2. ✅ 所有 POC 的 CSS 樣式已移植
3. ✅ 視覺效果與 POC 一致（截圖比對）
4. ✅ 互動行為與 POC 一致（手動測試）
```

#### Step 2: 使用 UI 移植工具

```bash
# 自動移植 POC UI 到專案
node control-tower/tools/migrate-poc-ui.cjs \
  .gems/iterations/iter-1/poc/TodoListPOC.html \
  --output .
```

工具會自動：
1. 提取 HTML 結構 → `index.html`
2. 提取 CSS 樣式 → `styles/main.css`
3. 提取 JS 邏輯 → `UI_MIGRATION_GUIDE.md`（需手動轉換為 TS）
4. 提取設計說明 → 移植指引

#### Step 3: 在 BUILD Phase 1 加入 UI 檢查

修改 `task-pipe/phases/build/phase-1.cjs`，在開始開發前檢查：

```javascript
// 檢查是否需要 UI 移植
if (isFoundation && hasPOC && !hasIndexHtml) {
  anchorError('BLOCKER',
    '偵測到 POC 但尚未移植 UI',
    'node control-tower/tools/migrate-poc-ui.cjs <poc-file> --output .',
    { context: 'Phase 1 | UI 移植檢查' }
  );
  return { verdict: 'BLOCKER' };
}
```

### 方案 B：在 BUILD 階段自動移植（次選）

如果 PLAN 階段忘記加入 UI 移植任務，可在 BUILD Phase 1 自動執行：

```javascript
// 在 phase-1.cjs 中
if (isFoundation && hasPOC && !hasIndexHtml) {
  console.log('🎨 自動執行 UI 移植...');
  execSync(`node control-tower/tools/migrate-poc-ui.cjs ${pocFile} --output ${target}`);
}
```

## 📋 實作檢查清單

### PLAN 階段
- [ ] Step 2.6 檢查是否有 POC
- [ ] 如有 POC，強制加入「UI 移植」Item (P0)
- [ ] 驗收標準包含「視覺一致性」檢查

### BUILD 階段
- [ ] Phase 1 檢查 `index.html` 是否存在
- [ ] Phase 1 檢查 CSS 檔案是否存在
- [ ] Phase 7 加入視覺回歸測試（可選）

### SCAN 階段
- [ ] 掃描 UI 元件是否有對應的 GEMS 標籤
- [ ] 檢查 CSS 是否有未使用的樣式

## 🛠️ 工具使用範例

### 1. 移植 POC UI

```bash
# 基本使用
node control-tower/tools/migrate-poc-ui.cjs \
  .gems/iterations/iter-1/poc/AppPOC.html

# 指定輸出目錄
node control-tower/tools/migrate-poc-ui.cjs \
  .gems/iterations/iter-1/poc/AppPOC.html \
  --output my-project
```

### 2. 檢查移植狀態

```bash
# 檢查是否已移植
ls index.html styles/main.css UI_MIGRATION_GUIDE.md
```

### 3. 視覺比對（手動）

1. 開啟 POC：`open .gems/iterations/iter-1/poc/AppPOC.html`
2. 開啟專案：`npm run dev`
3. 截圖比對

## 🎨 最佳實踐

### 1. POC 階段就規劃好移植策略

在 POC Step 2 產出 HTML 時，就考慮：
- 使用標準 HTML5 語義標籤
- CSS 使用 class 而非 inline style
- JS 邏輯與 UI 分離

### 2. 使用 CSS 變數方便主題切換

```css
:root {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --font-family: 'Arial', sans-serif;
}
```

### 3. 元件化思維

即使 POC 是單一 HTML，也要在註解中標記元件邊界：

```html
<!-- @COMPONENT: TodoItem -->
<div class="todo-item">
  ...
</div>
<!-- @END-COMPONENT -->
```

## 🚨 常見錯誤

### ❌ 錯誤 1：只移植邏輯，不移植 UI

```typescript
// 壞的做法
function mountUI() {
  document.body.innerHTML = '<h1>App Ready</h1>';
}
```

```typescript
// 好的做法
function mountUI() {
  // 從 POC 複製完整的 HTML 結構
  document.body.innerHTML = `
    <div class="app-container">
      <header class="app-header">...</header>
      <main class="app-main">...</main>
      <footer class="app-footer">...</footer>
    </div>
  `;
}
```

### ❌ 錯誤 2：忘記移植 CSS

只有 HTML 沒有 CSS，畫面會很醜。

### ❌ 錯誤 3：沒有視覺驗證

只跑單元測試，沒有開瀏覽器看畫面。

## 📊 成功指標

- ✅ `npm run dev` 可正常啟動
- ✅ 瀏覽器畫面與 POC 視覺一致度 > 90%
- ✅ 所有互動行為正常（按鈕、表單、導航）
- ✅ RWD 響應式設計正常（如 POC 有實作）

## 🔄 流程整合

```
POC Step 2 (產出 HTML)
    ↓
PLAN Step 2.6 (加入 UI 移植任務)
    ↓
BUILD Phase 1 (執行 migrate-poc-ui.cjs)
    ↓
BUILD Phase 2-6 (實作邏輯)
    ↓
BUILD Phase 7 (視覺驗證)
    ↓
SCAN (檢查 UI 標籤完整性)
```

## 📚 延伸閱讀

- `control-tower/flow/rules/design-rules.md` - 設計規則
- `control-tower/tools/migrate-poc-ui.cjs` - UI 移植工具
- `task-pipe/docs/BLUEMOUSE_GUIDE.md` - BlueMouse 整合指南
