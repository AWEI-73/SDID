# Scaffold Module - 骨架產生器

> 在驗證前自動產出符合 GEMS 標籤規範 v2.1 的骨架檔案

## 📋 模組結構

```
lib/scaffold/
├── index.cjs           # 模組入口
├── generator.cjs       # 核心骨架產生器
├── hook.cjs            # 整合 Hook（供 phases 調用）
├── compliance-check.cjs # 合規性檢查
├── demo.cjs            # 演示腳本
└── README.md           # 本文件
```

## 🎯 設計目的

1. **減少 AI 格式錯誤**: 預先產出包含完整 GEMS 標籤的骨架
2. **符合官方規範**: 100% 符合 `gems-tagging-complete-guide.md` v2.1
3. **驗證前置作業**: 在驗證失敗前先產出正確格式

## ⚡ Runner 自動整合

骨架產生器已整合至 `runner.cjs`，在執行以下步驟時**自動產出骨架**：

| Phase | Step | 產出骨架 |
|-------|------|----------|
| POC | 0 | `requirement_draft_iter-1.md` |
| POC | 1 | `{Module}Contract.ts` |
| POC | 2 | `{Module}POC.html` |
| POC | 3 | `requirement_spec_iter-1.md` |
| PLAN | 2-3 | `implementation_plan_Story-X.Y.md` |
| BUILD | 7 | `Fillback_Story-X.Y.md` + `iteration_suggestions_Story-X.Y.json` |

```bash
# 執行時自動產出骨架
node task-pipe/runner.cjs --phase=POC --step=3 --target=./my-project

# 輸出範例:
# [Scaffold] Ensuring scaffold for POC-3...
# [Scaffold] Generated: requirement_spec_iter-1.md
```

## 🚀 使用方式

### 基本使用

```javascript
const { generateScaffold, SCAFFOLD_TYPES } = require('./lib/scaffold');

// 產出 Implementation Plan 骨架
const result = generateScaffold(
  SCAFFOLD_TYPES.PLAN_IMPL,
  { 
    storyId: 'Story-1.0',
    moduleName: 'Task',
    objective: '建立任務管理基礎架構'
  },
  './output/implementation_plan_Story-1.0.md'
);
```

### 在 Phase 腳本中使用

```javascript
// 在 phases/plan/step-2.cjs 中
const { ensureScaffold } = require('../../lib/scaffold');

// 驗證前先產出骨架
ensureScaffold('PLAN', '2', { 
  target: options.target, 
  iteration: 'iter-1',
  story: 'Story-1.0'
});
```

### 執行演示

```bash
node task-pipe/lib/scaffold/demo.cjs
```

### 執行合規檢查

```bash
node task-pipe/lib/scaffold/compliance-check.cjs
```

## 📊 支援的骨架類型

| 類型 | 用途 | 驗證器來源 |
|------|------|-----------|
| `POC_DRAFT` | 需求草稿 | poc/step-0 |
| `POC_CONTRACT` | 資料契約 | poc/step-1 |
| `POC_HTML` | POC HTML | poc/step-2 |
| `POC_SPEC` | 需求規格 | poc/step-3 `validateSpec()` |
| `PLAN_IMPL` | 實作計畫 | plan/step-3 `validatePlan()` |
| `BUILD_FILLBACK` | Fillback | build/phase-7 `validatePhase7()` |
| `BUILD_SUGGESTIONS` | Suggestions | suggestions-validator |

## ✅ GEMS 標籤符合度

骨架產出的標籤 100% 符合 `gems-tagging-complete-guide.md` v2.1：

| 標籤 | 狀態 | 說明 |
|------|------|------|
| `GEMS:` 基礎格式 | ✅ | `Name \| P0 \| ✓✓ \| I→O \| Story \| Desc` |
| `GEMS-FLOW` | ✅ | 3-5 步驟 |
| `GEMS-DEPS` | ✅ | `[Type.Name (說明)]` 折衷格式 |
| `GEMS-DEPS-RISK` | ✅ | LOW/MEDIUM/HIGH |
| `GEMS-TEST` | ✅ | `✓ Unit \| ✓ Integration \| - E2E` |
| `GEMS-TEST-FILE` | ✅ | 指定測試檔案 |
| `[STEP]` 錨點 | ✅ | P0/P1 必備 |
| 無 `GEMS-ALGO` | ✅ | v2.1 已廢棄 |

## 🔧 API 參考

### generateScaffold(type, context, outputPath)

產生骨架檔案。

**參數**:
- `type`: 骨架類型 (`SCAFFOLD_TYPES.*`)
- `context`: 上下文物件 `{ storyId, moduleName, ... }`
- `outputPath`: 輸出路徑

**回傳**: `{ success, path, type, error? }`

### ensureScaffold(phase, step, options)

確保骨架存在，若不存在則產生。

**參數**:
- `phase`: `'POC'` | `'PLAN'` | `'BUILD'`
- `step`: 步驟編號
- `options`: `{ target, iteration, story, level }`

**回傳**: `{ generated, path, skipped, reason? }`

### validateScaffold(type, content)

驗證骨架內容是否符合規範。

**參數**:
- `type`: 骨架類型
- `content`: 內容字串

**回傳**: `{ valid, missing: [] }`

---

**版本**: 1.0.0  
**符合規範**: GEMS Tagging Guide v2.1  
**最後更新**: 2026-01-08
