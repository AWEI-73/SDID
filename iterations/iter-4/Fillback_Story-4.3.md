# Fillback Story-4.3: Story 編號判斷模組

## 基本資訊
- **Iteration**: iter-4
- **Story**: Story-4.3 Story 編號判斷模組
- **模組**: story-advisor
- **Type**: INFRASTRUCTURE
- **Priority**: P1
- **Status**: Completed
- **Date**: 2025-12-11

---

## 開發 Log

### Item 1: story-number-advisor.cjs
- [x] Phase 1: 開發腳本 ✅ COMPLETED
- [x] Phase 2: 測試腳本 ✅ COMPLETED (31/31 tests passed)
- [x] Phase 3: TDD 測試 ✅ COMPLETED
- [x] Phase 4: 修改檔案測試 ✅ COMPLETED
- [x] Phase 5: 完成規格 ✅ COMPLETED

**產出**:
- `tools/story-number-advisor.cjs` - Story 編號判斷工具（380 行）
- `tools/__tests__/story-number-advisor.test.cjs` - 單元測試（31 個測試）

**核心函式**:
| 函式名稱 | Priority | 狀態 | 說明 |
|----------|----------|------|------|
| `detectProjectStructure` | P1 | ✓✓ | 偵測專案結構 |
| `checkModuleExists` | P1 | ✓✓ | 檢查模組是否存在 |
| `detectArchitectureChange` | P1 | ✓✓ | 偵測架構變更 |
| `suggestStoryNumber` | P1 | ✓✓ | 建議 Story 編號 |
| `generateAdviceReport` | P1 | ✓✓ | 產生建議報告 |
| `parseArgs` | P2 | ✓✓ | 解析命令列參數 |
| `compareStoryNumbers` | P2 | ✓✓ | 比較 Story 編號 |

---

## 技術細節

### CLI 用法
```bash
# 檢查新模組
node story-number-advisor.cjs --module=meal-management

# 檢查既有模組
node story-number-advisor.cjs --project=./MMS --module=user-management

# 根據描述偵測架構變更
node story-number-advisor.cjs --desc="新增用戶認證模組"

# 輸出 JSON 格式
node story-number-advisor.cjs --module=inventory --json
```

### 判斷邏輯
```
需要 X.0（基礎建設）:
1. 新增模組資料夾（src/modules/[new-module]/）
2. 架構層級調整（例: 新增 src/shared/layouts/）
3. 描述包含 infrastructure, refactor, new-module, database, auth 等關鍵字

不需要 X.0（功能開發）:
1. 在既有模組新增功能
2. 修改現有檔案
3. 新增工具腳本（在 tools/ 目錄）
```

### 架構關鍵字清單
```javascript
const ARCHITECTURE_KEYWORDS = [
  'database', 'db', 'schema', 'migration',
  'auth', 'authentication', 'authorization',
  'layout', 'theme', 'style', 'css',
  'router', 'routing', 'navigation',
  'state', 'store', 'redux', 'zustand',
  'config', 'configuration', 'environment',
  'api', 'http', 'fetch', 'axios',
  'test', 'testing', 'jest', 'vitest',
  'build', 'webpack', 'vite', 'bundler',
  'refactor', 'restructure', 'reorganize',
];
```

---

## 測試結果

```
PASS tools/__tests__/story-number-advisor.test.cjs
  detectProjectStructure (3 tests)
  checkModuleExists (3 tests)
  detectArchitectureChange (8 tests)
  suggestStoryNumber (4 tests)
  parseArgs (8 tests)
  compareStoryNumbers (3 tests)
  ARCHITECTURE_KEYWORDS (1 test)

Test Suites: 1 passed, 1 total
Tests:       31 passed, 31 total
```

---

## 驗收標準達成

| AC | 說明 | 狀態 |
|----|------|------|
| AC-4.3.1 | 執行 `node tools/story-number-advisor.cjs --project=... --module=...` | ✅ |
| AC-4.3.2 | 若模組資料夾不存在，建議使用 Story-X.0 | ✅ |
| AC-4.3.3 | 若模組資料夾已存在，建議使用 Story-X.1+ | ✅ |
| AC-4.3.4 | 產生建議報告（建議編號、理由、相關檔案清單） | ✅ |
| AC-4.3.5 | 支援 `--description` 參數 | ✅ |
| AC-4.3.6 | 支援 `--json` 參數 | ✅ |

---

## TACTICAL_FIX（無）

本次開發順利完成，未遇到需要 TACTICAL_FIX 的問題。

---

✅ **Story-4.3 完成**

**iter-4 所有 Stories 已完成！**
