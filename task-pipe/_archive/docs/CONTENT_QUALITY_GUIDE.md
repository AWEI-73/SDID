# POC Content Quality Enhancement

## 🎯 問題描述

**原始問題**: `requirement_spec` 只有骨架格式就能通過 POC Step 3 驗證

**根本原因**:
1. `validateSpec()` 只檢查關鍵字存在（如 "用戶故事"、"Given/When/Then"）
2. 不檢查內容是否為佔位符（如 `{角色}`、`{功能}`）
3. 骨架產生器產生的模板可以直接通過驗證

## ✅ 解決方案

### 1. 新增內容質量檢查器

**檔案**: `task-pipe/phases/poc/content-quality-checker.cjs`

**功能**:
- ✅ 佔位符檢測（中英文）
- ✅ 模糊短語檢測
- ✅ 用戶故事完整性檢查（角色、功能、目標）
- ✅ 驗收標準完整性檢查（Given/When/Then）
- ✅ 資料契約質量檢查
- ✅ 質量評分系統（0-100分）

**質量等級**:
- `GOOD` (80-100分): 內容完整，可以進入 PLAN
- `POOR` (50-79分): 內容不佳，給予警告但允許繼續
- `SKELETON` (0-49分): 只是骨架，**BLOCKER** 阻擋進入 PLAN

### 2. 整合到 POC Step 3

**修改**: `task-pipe/phases/poc/step-3.cjs`

**新增邏輯**:
```javascript
// 格式驗證通過後，進行內容質量檢查
const qualityResult = checkContentQuality(content);

if (qualityResult.quality === 'SKELETON') {
  // BLOCKER: 阻擋進入 PLAN
  return { verdict: 'BLOCKER', qualityScore: 0 };
}

if (qualityResult.quality === 'POOR') {
  // WARN: 警告但允許繼續
  console.log('WARN: 內容質量不佳，建議改善');
}
```

## 🚀 使用方式

### 獨立執行檢查器

```bash
# 檢查特定項目的 requirement_spec
node task-pipe/phases/poc/content-quality-checker.cjs --target=poc-qbank --iteration=iter-1

# 查看詳細分析
node task-pipe/phases/poc/content-quality-checker.cjs --target=poc-qbank --verbose
```

### 通過 Runner 自動執行

```bash
# POC Step 3 會自動執行內容質量檢查
node task-pipe/runner.cjs --phase=POC --step=3 --target=poc-qbank
```

**輸出範例**:
```
BLOCKER: Spec 只是骨架，缺少實質內容
質量評分: 0/100

發現的問題:
  🔴 1. 發現 6 個佔位符
  🟡 2. 發現 7 個模糊描述
  🔴 3. 用戶故事缺少具體的角色描述
  🔴 4. 用戶故事缺少具體的功能描述
  🔴 5. 用戶故事缺少具體的目標描述
  🔴 6. 驗收標準的 Given/When/Then 缺少具體內容
  🟡 7. 資料契約只有參考連結，缺少摘要說明

建議: 執行 node task-pipe/phases/poc/content-quality-checker.cjs --target=poc-qbank 查看詳細改善建議
X 禁止進入 PLAN | OK 補充內容後重跑 step=3
```

## 📊 檢測項目

### 佔位符模式

**中文**:
- `{角色}`, `{功能}`, `{目標}`
- `{前置條件}`, `{操作動作}`, `{預期結果}`
- `[角色]`, `[功能]`, `[目標]`
- `TODO`, `TBD`, `待填寫`, `待補充`

**英文**:
- `{role}`, `{feature}`, `{goal}`
- `{precondition}`, `{action}`, `{result}`

### 模糊短語

- "作為 {角色}"
- "我想要 {功能}"
- "以便於 {目標}"
- "Given {", "When {", "Then {"
- "參見", "待定", "未定義"

### 完整性檢查

1. **用戶故事**: 必須有具體的角色、功能、目標描述（至少 5 個字）
2. **驗收標準**: Given/When/Then 必須有具體內容（至少 10 個字）
3. **資料契約**: 不能只有「參見 xxxContract.ts」

## 💡 改善建議範例

檢查器會自動產生改善建議：

```json
{
  "priority": "P0",
  "action": "替換佔位符",
  "detail": "將 {角色}, {功能}, {目標} 替換為具體內容",
  "example": "例如: {角色} → 題庫管理員"
}
```

## 🔧 未來擴展

### 可能的改進方向

1. **AI 輔助補全**: 整合 LLM 自動填充佔位符
2. **範例庫**: 提供不同領域的優質 requirement_spec 範例
3. **漸進式驗證**: 允許部分完成的 spec（標註 WIP）
4. **多語言支援**: 支援英文、日文等其他語言的檢查

### 其他階段應用

這個模式可以擴展到其他階段：

- **PLAN Phase**: 檢查 `implementation_plan` 的完整性
- **BUILD Phase**: 檢查 `Fillback` 的質量
- **SCAN Phase**: 檢查測試覆蓋率報告的完整性

## 📈 效果評估

**Before** (無質量檢查):
- ❌ 骨架文件可以通過驗證
- ❌ 進入 PLAN 階段後才發現內容不足
- ❌ 浪費時間在無效的迭代上

**After** (有質量檢查):
- ✅ 骨架文件被 BLOCKER 阻擋
- ✅ 在 POC 階段就確保內容質量
- ✅ 提供具體的改善建議
- ✅ 節省後續階段的時間

## 🎓 最佳實踐

1. **先執行檢查器**: 在提交 requirement_spec 前，先執行獨立檢查器
2. **參考改善建議**: 根據檢查器的建議逐項改善
3. **目標 80+ 分**: 確保質量評分至少達到 80 分
4. **具體化描述**: 避免使用模糊的詞彙，盡量具體

---

**版本**: 1.0.0  
**建立日期**: 2026-01-09  
**作者**: Task-Pipe Team
