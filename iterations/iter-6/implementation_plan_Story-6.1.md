# Implementation Plan - Story-6.1

**迭代**: iter-6  
**Story ID**: Story-6.1  
**Story**: POC 節點工具  
**日期**: 2025-12-13  
**目標模組**: flow-tools

> 📋 **放置位置**: `.gems/iterations/iter-6/implementation_plan_Story-6.1.md`

---

## 1. Story 目標

**一句話目標**: 建立 POC 初始化工具，自動產生新迭代資料夾和 POC 樣板檔案

**範圍**:
- ✅ 包含: init-poc.cjs 工具、UI 整合、API endpoint
- ❌ 不包含: POC HTML 解析工具（已存在）

---

## 2. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | init-poc.cjs 工具 | FEATURE | P0 | ✅ 明確 | 已完成 ✅ |
| 2 | POC API endpoint | FEATURE | P0 | ✅ 明確 | 2-3h |
| 3 | UI 整合 | FEATURE | P0 | ✅ 明確 | 1-2h |

**執行順序**: Item 1 (已完成) → Item 2 → Item 3

---

## 4. Item 詳細規格

### Item 1: init-poc.cjs 工具 ✅ 已完成

**Status**: ✅ 已完成  
**檔案**: `control-tower/tools/init-poc.cjs`

**功能**:
- 偵測下一個迭代編號
- 建立 `.gems/iterations/iter-X/` 資料夾
- 產生 `requirement_spec_iter-X.md` 樣板
- 產生 `POC-iter-X.html` 樣板

---

### Item 2: POC API endpoint

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 建立 API endpoint 呼叫 init-poc.cjs

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/src/modules/flow-tools/api/pocRoutes.ts` | New | POC API 路由 |
| `control-tower/src/modules/flow-tools/services/pocService.ts` | New | POC 服務邏輯 |
| `control-tower/src/modules/flow-tools/index.ts` | Modify | 匯出服務 |

**核心函式**:
1. `initPoc(projectPath, iteration?)` - 初始化 POC

**API 設計**:
```typescript
POST /api/poc/init
{
  "projectPath": "/path/to/project",
  "iteration": 7  // optional
}

Response:
{
  "success": true,
  "iterationNumber": 7,
  "createdFiles": ["requirement_spec_iter-7.md", "POC-iter-7.html"],
  "createdDir": ".gems/iterations/iter-7"
}
```

**驗收標準**:
- AC-6.1.1: POST /api/poc/init 可正常呼叫
- AC-6.1.2: 自動偵測迭代編號
- AC-6.1.3: 產生檔案到 `.gems/iterations/`
- AC-6.1.4: 回傳產出清單

---

### Item 3: UI 整合

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 整合「開始 POC」按鈕到 UI

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/public/app.js` | Modify | 實作 handlePocInit() |

**核心函式**:
1. `handlePocInit()` - 呼叫 API 並顯示結果

**驗收標準**:
- AC-6.1.5: 點擊「開始 POC」呼叫 API
- AC-6.1.6: 顯示產出檔案清單
- AC-6.1.7: 錯誤處理完善

---

## 5. 規格注入

### 5.1 資料契約 (@GEMS-CONTRACT)

```typescript
// @GEMS-STORY: Story-6.1
// @GEMS-CONTRACT: InitPocResult
interface InitPocResult {
  success: boolean;
  iterationNumber: number;
  createdFiles: string[];
  createdDir: string;
  outputDir: string;
}
```

---

## 6. 檔案結構定義

```json
{
  "fileStructure": {
    "modules": [
      {
        "id": "flow-tools",
        "path": "control-tower/src/modules/flow-tools",
        "isNew": false,
        "files": [
          {
            "name": "api/pocRoutes.ts",
            "type": "route",
            "functions": [
              {
                "name": "POST /api/poc/init",
                "priority": "P0",
                "testTypes": ["Integration"]
              }
            ]
          },
          {
            "name": "services/pocService.ts",
            "type": "service",
            "functions": [
              {
                "name": "initPoc",
                "priority": "P0",
                "testTypes": ["Unit"]
              }
            ]
          }
        ],
        "tests": [
          {
            "name": "services/__tests__/pocService.test.ts",
            "covers": ["initPoc"]
          }
        ]
      }
    ]
  }
}
```

---

## 7. 依賴關係

| 依賴 | 類型 | 說明 |
|------|------|------|
| init-poc.cjs | internal | POC 初始化工具 |
| Express | lib | API 框架 |
| child_process | lib | 執行 CLI 工具 |

---

## 8. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **複雜度檢核** | ✅ 通過 | 使用現有工具，無新依賴 |
| **封裝檢核** | ✅ 通過 | Service 層封裝適當 |
| **P0 函式檢核** | ✅ 通過 | 1 個核心函式 |

---

## 9. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| 工具執行失敗 | Medium | 錯誤處理 + 詳細錯誤訊息 |
| 路徑不存在 | Medium | 路徑驗證 |

---

**產出日期**: 2025-12-13 | **Agent**: PLAN
