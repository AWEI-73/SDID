# Phase 4 自動修正使用指南

## 🎯 使用場景

當 BUILD Phase 4 (標籤驗收) 失敗 3 次後，Code Reviewer 會自動介入並提供兩種選擇：

1. **自動修正** (--auto-fix): AI 自動插入缺失的標籤
2. **人工修正**: 產生詳細報告，由人工修正

---

## 🚀 快速開始

### 方案 A: 自動修正（推薦）

```bash
# 在 phase-4.cjs 中加入 --auto-fix 參數支援
node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-1.0 --auto-fix
```

**效果**:
- ✅ 自動插入缺失的 GEMS-DEPS
- ✅ 自動插入缺失的 GEMS-FLOW
- ✅ 自動插入缺失的 GEMS-DEPS-RISK
- ⏭️ 跳過需要理解邏輯的修正（如 [STEP] 錨點）

### 方案 B: Dry Run（先看看會改什麼）

```bash
# 不加 --auto-fix，只產生修正計畫
node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-1.0
```

**效果**:
- 🔍 產生修正計畫
- 📄 產生 Code Review 報告
- 💡 提示哪些可以自動修正
- ❌ 不會實際修改檔案

---

## 📋 自動修正範例

### 修正前

```javascript
/**
 * GEMS: getFromStorage | P0 | ✓✓ | (key)→any | Story-1.0 | 從 LocalStorage 讀取
 * GEMS-FLOW: ReadStorage→Parse→Return
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: storage.test.js
 */
export function getFromStorage(key) {
  // ...
}
```

**問題**: 缺少 GEMS-DEPS 和 GEMS-DEPS-RISK

### 自動修正後

```javascript
/**
 * GEMS: getFromStorage | P0 | ✓✓ | (key)→any | Story-1.0 | 從 LocalStorage 讀取
 * GEMS-FLOW: ReadStorage→Parse→Return
 * GEMS-DEPS: [Browser.localStorage (讀取)]          ← 自動插入
 * GEMS-DEPS-RISK: LOW                                ← 自動插入
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: storage.test.js
 */
export function getFromStorage(key) {
  // ...
}
```

---

## 🔧 整合到 phase-4.cjs

```javascript
// task-pipe/phases/build/phase-4.cjs
const { handlePhase4Failure } = require('../../skills/code-reviewer/integration-example.cjs');

function run(options) {
  const { target, iteration, story, autoFix } = options;
  
  // ... 原有的標籤驗證邏輯 ...
  
  if (!passed) {
    // 使用 Code Reviewer + Auto Fixer
    const result = await handlePhase4Failure({
      target,
      iteration,
      story,
      errors: complianceIssues,
      autoFix: autoFix || false  // 從命令列參數取得
    });
    
    return result;
  }
  
  return { verdict: 'PASS' };
}
```

---

## 📊 修正報告範例

### Code Review 報告
```markdown
# Code Review Report

**階段**: BUILD Phase 4 - 標籤驗收
**失敗次數**: 3
**嚴重程度**: CRITICAL

## 🔍 錯誤分析

### 偵測到的錯誤
1. **MISSING_CONTENT**: 缺少 GEMS-DEPS 標籤
   - 位置: `src/utils/storage.js:45`
2. **MISSING_CONTENT**: P0 函式缺少 GEMS-DEPS-RISK
   - 位置: `src/utils/storage.js:45`
```

### 自動修正報告
```markdown
# GEMS Tag 自動修正報告

**總修正項目**: 2
**可自動修正**: 2
**需人工修正**: 0

## 執行結果

- ✅ 成功: 2
- ❌ 失敗: 0
- ⏭️ 跳過: 0

## 修正項目

### ✅ ADD_TAG - src/utils/storage.js:45

**動作**: 自動修正
**插入**: ` * GEMS-DEPS: [Internal.helper (說明)]`

### ✅ ADD_TAG - src/utils/storage.js:45

**動作**: 自動修正
**插入**: ` * GEMS-DEPS-RISK: LOW`
```

---

## ⚠️ 限制與注意事項

### 可以自動修正的

✅ 缺少 GEMS-DEPS（插入模板）  
✅ 缺少 GEMS-FLOW（插入模板）  
✅ 缺少 GEMS-DEPS-RISK（插入 LOW）  
✅ 缺少 GEMS-TEST（插入模板）  
✅ 缺少 GEMS-TEST-FILE（插入模板）  

### 無法自動修正的

❌ [STEP] 錨點（需要理解程式碼邏輯）  
❌ GEMS-FLOW 步驟錯誤（需要分析業務流程）  
❌ GEMS-DEPS 依賴錯誤（需要分析實際依賴）  
❌ 標籤與程式碼不一致（需要理解實作）  

### 建議

1. **先 Dry Run**: 看看會改什麼
2. **檢查結果**: 自動修正後檢查是否正確
3. **手動調整**: 修正模板內容（如 GEMS-DEPS 的具體依賴）
4. **重新驗證**: 執行 Phase 4 確認通過

---

## 🎓 設計理念

### 為什麼只修正「簡單」的問題？

1. **安全性**: 避免誤改程式碼邏輯
2. **可預測性**: 只插入標準模板，不做複雜推理
3. **效率**: 80% 的標籤問題都是「忘記加」，不是「加錯」

### 為什麼需要 3 次失敗？

1. **給 AI 機會**: 前 2 次讓 AI 自己修正
2. **避免過早介入**: 可能只是小錯誤
3. **確認是系統性問題**: 3 次失敗代表 AI 無法自行解決

---

## 📝 TODO

- [ ] 支援更多標籤類型的自動修正
- [ ] 智能推測 GEMS-DEPS 的實際依賴
- [ ] 使用 LLM 分析程式碼邏輯，自動加 [STEP] 錨點
- [ ] 支援批次修正（一次修正多個檔案）

---

**版本**: 1.0.0  
**更新日期**: 2026-01-08
