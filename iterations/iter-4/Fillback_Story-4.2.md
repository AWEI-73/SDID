# Fillback Story-4.2: 腳手架產生模組

## 基本資訊
- **Iteration**: iter-4
- **Story**: Story-4.2 腳手架產生模組
- **模組**: scaffold-generator
- **Type**: INFRASTRUCTURE
- **Priority**: P0
- **Status**: Completed
- **Date**: 2025-12-11

---

## 開發 Log

### Item 2: Skeleton Templates
- [x] Phase 1: 建立 skeleton 目錄 ✅ COMPLETED
- [x] Phase 2: 建立 config.skeleton.ts ✅ COMPLETED
- [x] Phase 3: 建立 layout.skeleton.tsx ✅ COMPLETED
- [x] Phase 4: 建立 component.skeleton.tsx ✅ COMPLETED
- [x] Phase 5: 建立 store.skeleton.ts ✅ COMPLETED

**產出**:
- `docs/templates/code/skeleton/config.skeleton.ts`
- `docs/templates/code/skeleton/layout.skeleton.tsx`
- `docs/templates/code/skeleton/component.skeleton.tsx`
- `docs/templates/code/skeleton/store.skeleton.ts`

---

### Item 1: 擴展 scaffold-files.cjs
- [x] Phase 1: 實作 detectMode ✅ COMPLETED
- [x] Phase 2: 實作 loadSkeletonTemplate ✅ COMPLETED
- [x] Phase 3: 修改 loadTemplate 支援 mode ✅ COMPLETED
- [x] Phase 4: 修改 main 解析 --mode 參數 ✅ COMPLETED
- [x] Phase 5: 更新測試 ✅ COMPLETED (34/34 tests passed)
- [x] Phase 6: 修改檔案測試 ✅ COMPLETED
- [x] Phase 7: 完成規格 ✅ COMPLETED

**產出**:
- `tools/scaffold-files.cjs` - 擴展版本（支援 skeleton/full 模式）
- `tools/__tests__/scaffold-files.test.cjs` - 更新的測試（34 個測試）

**新增函式**:
| 函式名稱 | Priority | 狀態 | 說明 |
|----------|----------|------|------|
| `detectMode` | P0 | ✓✓ | 自動偵測模式（Story-X.0 → skeleton） |
| `loadSkeletonTemplate` | P0 | ✓✓ | 載入 skeleton template |
| `parseArgs` | P1 | ✓✓ | 解析命令列參數 |

**修改函式**:
| 函式名稱 | 修改 | 說明 |
|----------|------|------|
| `loadTemplate` | 新增 mode 參數 | 支援 skeleton/full 模式切換 |
| `generateReport` | 顯示模式 | 報告中顯示使用的模式 |
| `main` | --mode 參數 | 支援模式參數解析和自動偵測 |

---

## 技術細節

### CLI 用法
```bash
# Module 0 基礎建設（自動偵測 Story-X.0）
node scaffold-files.cjs iterations/iter-1/implementation_plan_Story-1.0.md

# Module N 功能開發（自動偵測 Story-X.1+）  
node scaffold-files.cjs iterations/iter-2/implementation_plan_Story-2.1.md

# 手動指定模式
node scaffold-files.cjs plan.md --mode=skeleton
node scaffold-files.cjs plan.md --mode=full

# 預覽模式
node scaffold-files.cjs plan.md --dry-run
```

### 模式自動偵測邏輯
```javascript
// Story-X.0 → skeleton mode (Module 0 基礎建設)
// Story-X.1+ → full mode (Module N 功能開發)
const storyMatch = content.match(/Story[- ]?(\d+)\.(\d+)/i);
if (storyMatch[2] === '0') return 'skeleton';
else return 'full';
```

### Skeleton Template 對應
| templateType | skeleton file |
|--------------|---------------|
| config | config.skeleton.ts |
| store | store.skeleton.ts |
| component | component.skeleton.tsx |
| layout | layout.skeleton.tsx |
| hook | component.skeleton.tsx |
| service/api/util | config.skeleton.ts |

---

## 測試結果

```
PASS tools/__tests__/scaffold-files.test.cjs
  scaffold-files.cjs
    parseFileStructure (4 tests)
    replaceTemplateVariables (4 tests)
    generateFile (2 tests)
    checkExistingFiles (2 tests)
    generateReport (4 tests) [新增 skeleton/full 模式測試]
    detectMode (4 tests) [新增]
    loadSkeletonTemplate (4 tests) [新增]
    loadTemplate with mode (2 tests) [新增]
    parseArgs (8 tests) [新增]

Test Suites: 1 passed, 1 total
Tests:       34 passed, 34 total
```

---

## 驗收標準達成

| AC | 說明 | 狀態 |
|----|------|------|
| AC-4.2.1 | 支援 `--mode=skeleton` 參數 | ✅ |
| AC-4.2.2 | 支援 `--mode=full` 參數 | ✅ |
| AC-4.2.3 | 自動偵測模式（Story-X.0 → skeleton） | ✅ |
| AC-4.2.4 | skeleton mode 產生只有 GEMS 標籤的檔案 | ✅ |
| AC-4.2.5 | full mode 產生包含函數簽名的檔案 | ✅ |
| AC-4.2.6 | 更新測試覆蓋新增函式 | ✅ |
| AC-4.2.7 | 新增 4 個 skeleton template 檔案 | ✅ |
| AC-4.2.8 | 每個 template 包含完整 GEMS 標籤範例 | ✅ |
| AC-4.2.9 | 每個 template 包含 TODO 註解 | ✅ |
| AC-4.2.10 | 使用 `{變數}` 格式標記可替換部分 | ✅ |

---

## TACTICAL_FIX（無）

本次開發順利完成，未遇到需要 TACTICAL_FIX 的問題。

---

✅ **Story-4.2 完成**

下一步：Story-4.3 Story 編號判斷模組
