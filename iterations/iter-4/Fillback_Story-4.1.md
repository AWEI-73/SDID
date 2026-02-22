# Fillback Story-4.1: 專案初始化模組

## 基本資訊
- **Iteration**: iter-4
- **Story**: Story-4.1 專案初始化模組
- **模組**: project-init
- **Type**: INFRASTRUCTURE
- **Priority**: P0
- **Status**: Completed
- **Date**: 2025-12-11

---

## 開發 Log

### Item 1: init-project.cjs
- [x] Phase 1: 開發腳本 ✅ COMPLETED
- [x] Phase 2: 測試腳本 ✅ COMPLETED
- [x] Phase 3: TDD 測試 ✅ COMPLETED (20/20 tests passed)
- [x] Phase 4: 標籤驗收 ✅ COMPLETED (GEMS Gate Passed)
- [x] Phase 5: Test Gate ✅ COMPLETED
- [x] Phase 6: 修改檔案測試 ✅ COMPLETED
- [x] Phase 7: 完成規格 ✅ COMPLETED

**產出**:
- `tools/init-project.cjs` - 專案初始化腳本（419 行）
- `tools/__tests__/init-project.test.cjs` - 單元測試（20 個測試）

**核心函式**:
| 函式名稱 | Priority | 狀態 | 說明 |
|----------|----------|------|------|
| `validateProjectPath` | P0 | ✓✓ | 驗證專案路徑 |
| `checkGemsExists` | P0 | ✓✓ | 檢查 .gems/ 是否已存在 |
| `copyDirectory` | P1 | ✓✓ | 遞迴複製目錄 |
| `copyGemsInfrastructure` | P0 | ✓✓ | 複製 GEMS 基礎設施 |
| `generateProjectConfig` | P0 | ✓✓ | 產生專案配置檔 |
| `createHorizontalLayers` | P0 | ✓✓ | 產生橫向分層結構 |
| `createIndexFiles` | P2 | ✓✓ | 建立 index.ts 檔案 |
| `generateReport` | P0 | ✓✓ | 產出初始化報告 |
| `parseArgs` | P1 | ✓✓ | 解析命令列參數 |
| `main` | P0 | ✓✓ | 主程式入口 |

---

### Item 2: 配置檔範本
- [x] Phase 1: 建立 config.template.json ✅ COMPLETED

**產出**:
- `docs/templates/config.template.json` - 專案配置範本

---

## 技術細節

### CLI 用法
```bash
# 基本用法
node tools/init-project.cjs --path=./my-project --name=MyProject

# 使用位置參數
node tools/init-project.cjs ./my-project

# 強制覆蓋
node tools/init-project.cjs --path=./my-project --force

# 顯示說明
node tools/init-project.cjs --help
```

### 複製的項目
- `flow/` - Flow 定義
- `prompts/` - Prompt 模板
- `tools/` - 驗證工具
- `docs/guides/` - 指南文件
- `docs/templates/` - 文件模板

### 產生的橫向分層結構
```
src/
├── config/        # 全域配置
├── assets/styles/ # 靜態資源
├── lib/           # 第三方庫封裝
├── shared/        # 跨模組共用
│   ├── components/
│   ├── layouts/
│   ├── store/
│   ├── utils/
│   └── types/
├── modules/       # 核心業務邏輯
└── routes/        # 路由定義
```

---

## 測試結果

```
PASS tools/__tests__/init-project.test.cjs
  validateProjectPath
    √ should return true for existing directory
    √ should create directory if not exists
    √ should throw error for empty path
    √ should throw error if path is a file
  checkGemsExists
    √ should return false when .gems does not exist
    √ should return true when .gems exists
  copyDirectory
    √ should copy all files recursively
    √ should skip node_modules and .git
    √ should return 0 for non-existent source
  generateProjectConfig
    √ should create config.json with correct content
  createHorizontalLayers
    √ should create all horizontal layer folders
    √ should not recreate existing folders
    √ should create index.ts files for main directories
  parseArgs
    √ should parse --path argument
    √ should parse --name argument
    √ should parse --force flag
    √ should parse -f flag
    √ should use positional argument as path
    √ should extract name from path if not provided
    √ should handle empty args

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
```

---

## 驗收標準達成

| AC | 說明 | 狀態 |
|----|------|------|
| AC-4.1.1 | 執行 `node tools/init-project.cjs --path=... --name=...` | ✅ |
| AC-4.1.2 | 自動複製 `.gems/` 目錄到目標專案 | ✅ |
| AC-4.1.3 | 產生 `.gems/config.json` 配置檔 | ✅ |
| AC-4.1.4 | 產生橫向分層結構 | ✅ |
| AC-4.1.5 | 若 `.gems/` 已存在則報錯，不覆蓋 | ✅ |
| AC-4.1.6 | 產出報告包含複製的檔案數量、產生的資料夾清單 | ✅ |
| AC-4.1.7 | 新增 `config.template.json` 範本 | ✅ |
| AC-4.1.8 | 範本包含專案名稱、路徑、版本、迭代編號等欄位 | ✅ |
| AC-4.1.9 | 使用 `{變數}` 格式標記可替換部分 | ✅ |

---

## TACTICAL_FIX（無）

本次開發順利完成，未遇到需要 TACTICAL_FIX 的問題。

---

✅ **Story-4.1 完成**

下一步：Story-4.2 腳手架產生模組
