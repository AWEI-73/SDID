# Task-Pipe AI 使用指南

## 為什麼需要 `--ai` 模式？

### 問題背景

當 AI 工具（如 Kiro、Claude Desktop、Cursor）執行命令時：

1. **捕獲方式不同**
   - AI 工具使用 `child_process.exec()` 或類似方式
   - 需要同時捕獲 stdout 和 stderr
   - 通常會使用 `2>&1` 合併輸出流

2. **編碼問題**
   - PowerShell 的 `2>&1` 會改變編碼
   - UTF-8 → 系統預設編碼（Big5/CP950）
   - 導致中文變成亂碼：`專案` → `撠?撉?`

3. **沒有真實終端機**
   - AI 工具不是在「真實終端機」執行
   - `process.stdout.isTTY` 會是 `false`
   - 無法使用終端機的原生編碼處理

---

## 解決方案：`--ai` 模式

### 使用方式

```bash
# AI 工具專用（推薦）
node task-pipe/runner.cjs --phase=BUILD --step=1 --ai

# 等同於
node task-pipe/runner.cjs --phase=BUILD --step=1 --plain
```

### `--ai` 模式做了什麼？

1. **強制 UTF-8 輸出**
   ```javascript
   // 將所有字串轉換為 UTF-8 Buffer
   process.stdout.write(Buffer.from(message, 'utf8'));
   ```

2. **移除 ANSI 色彩**
   - 無色彩輸出，避免控制碼干擾
   - 更容易被 AI 解析

3. **結構化結果**
   ```json
   {
     "verdict": "PASS",
     "phase": "BUILD",
     "step": "1"
   }
   ```

---

## 使用場景對比

### 場景 1: AI 工具執行（Kiro/Claude）

```bash
# ✓ 正確
node task-pipe/runner.cjs --phase=BUILD --step=1 --ai

# ✗ 錯誤（會亂碼）
node task-pipe/runner.cjs --phase=BUILD --step=1
```

**原因**: AI 工具會自動加 `2>&1`，導致編碼問題

---

### 場景 2: 人類在終端機執行

```bash
# ✓ 正確（有色彩，更美觀）
node task-pipe/runner.cjs --phase=BUILD --step=1

# ✓ 也可以（無色彩）
node task-pipe/runner.cjs --phase=BUILD --step=1 --plain
```

**原因**: 真實終端機有正確的編碼處理

---

### 場景 3: 重定向到檔案

```bash
# ✓ 正確
node task-pipe/runner.cjs --phase=BUILD --step=1 --plain > output.log

# ✓ 也可以（AI 模式）
node task-pipe/runner.cjs --phase=BUILD --step=1 --ai > output.log

# ✗ 錯誤（會亂碼）
node task-pipe/runner.cjs --phase=BUILD --step=1 > output.log
```

**原因**: 重定向會觸發 `!process.stdout.isTTY`，需要特殊處理

---

## 技術細節

### 為什麼 `2>&1` 會破壞編碼？

```powershell
# PowerShell 執行流程
node script.js 2>&1
  ↓
1. Node.js 輸出 UTF-8
  ↓
2. PowerShell 捕獲輸出
  ↓
3. 轉換為系統預設編碼（Big5）
  ↓
4. 中文變亂碼
```

### `--ai` 模式如何解決？

```javascript
// 在 Node.js 層面強制 UTF-8
process.stdout.write = function(chunk) {
  if (typeof chunk === 'string') {
    chunk = Buffer.from(chunk, 'utf8');  // 強制 UTF-8
  }
  return originalWrite(chunk);
};
```

---

## 快速參考

| 使用者 | 命令 | 原因 |
|--------|------|------|
| AI 工具 | `--ai` | 避免 `2>&1` 編碼問題 |
| 終端機 | 無參數 | 原生編碼正常 |
| 重定向 | `--plain` 或 `--ai` | 避免 ANSI 控制碼 |
| 腳本 | `--plain` | 易於解析 |

---

## 常見問題

### Q: 為什麼不預設使用 `--ai` 模式？

A: 因為人類在終端機使用時，色彩輸出更友善。只有在 AI 工具或重定向時才需要特殊處理。

### Q: `--plain` 和 `--ai` 有什麼差別？

A: 
- `--plain`: 只移除色彩
- `--ai`: `--plain` + 強制 UTF-8 + 結構化輸出

### Q: 如何判斷是否需要 `--ai`？

A: 如果你看到亂碼（如 `撠?撉?`），就需要 `--ai` 模式。

---

## 測試

```bash
# 測試 1: 直接執行（應該正常）
node task-pipe/runner.cjs --phase=PLAN --step=2.5

# 測試 2: AI 模式（應該正常）
node task-pipe/runner.cjs --phase=PLAN --step=2.5 --ai

# 測試 3: 重定向（應該正常）
node task-pipe/runner.cjs --phase=PLAN --step=2.5 --ai > test.log
type test.log
```

---

**更新日期**: 2026-01-11  
**適用版本**: Task-Pipe v1.3+
