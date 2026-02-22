# Implementation Plan - Story-6.3

**迭代**: iter-6  
**Story ID**: Story-6.3  
**日期**: 2025-12-13  
**目標模組**: flow-tools

> 📋 **放置位置**: `.gems/iterations/iter-6/implementation_plan_Story-6.3.md`

---

## 1. Story 目標

**一句話目標**: 建立 BUILD 骨架產生工具，從 implementation_plan 自動產生含完整 GEMS 標籤的程式碼骨架 ⭐

**範圍**:
- ✅ 包含: sync-scaffold.cjs 增強、骨架內嵌 GEMS 標籤、UI 整合
- ❌ 不包含: 實際程式碼實作（BUILD 階段）

---

## 2. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | sync-scaffold.cjs 增強 | FEATURE | P0 | ✅ 明確 | 4-5h |
| 2 | 骨架樣板系統 | FEATURE | P0 | ✅ 明確 | 3-4h |
| 3 | BUILD API endpoint | FEATURE | P0 | ✅ 明確 | 2-3h |
| 4 | UI 整合 | FEATURE | P0 | ✅ 明確 | 1-2h |

**執行順序**: Item 1 → Item 2 → Item 3 → Item 4

---

## 4. Item 詳細規格

### Item 1: sync-scaffold.cjs 增強

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 增強 sync-scaffold 工具，支援解析 implementation_plan 的檔案結構定義

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/tools/sync-scaffold.cjs` | Modify | 增強解析邏輯 |

**核心函式**:
1. `parseFileStructure(planContent)` - 解析 fileStructure JSON
2. `detectNewModules(fileStructure)` - 偵測新模組
3. `generateModuleReadme(moduleName)` - 產生模組 README

**驗收標準**:
- AC-6.3.1: 可解析 implementation_plan 的 fileStructure 區塊
- AC-6.3.2: 偵測是否為新模組（isNew: true）
- AC-6.3.3: 新模組自動產生 README.md

---

### Item 2: 骨架樣板系統

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 建立程式碼骨架樣板，內嵌完整 GEMS 標籤

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/docs/templates/code/service.template.ts` | Modify | Service 骨架樣板 |
| `control-tower/docs/templates/code/route.template.ts` | New | Route 骨架樣板 |
| `control-tower/docs/templates/code/test.template.ts` | Modify | Test 骨架樣板 |

**骨架樣板格式**:
```typescript
/**
 * GEMS: {functionName} | {priority} | ✓□ | ({params})→{returnType} | {storyId} | {description}
 * GEMS-FLOW: {flow}
 * GEMS-DEPS:
 *   - [internal] {dependency}
 * GEMS-TEST: □ Unit
 * GEMS-TEST-FILE: {testFile}
 */
export function {functionName}({params}: {ParamType}): {ReturnType} {
  // TODO: implement
  throw new Error('Not implemented');
}
```

**驗收標準**:
- AC-6.3.4: Service 樣板包含完整 GEMS 標籤
- AC-6.3.5: Route 樣板包含完整 GEMS 標籤
- AC-6.3.6: Test 樣板包含測試結構
- AC-6.3.7: 樣板支援變數替換

---

### Item 3: BUILD API endpoint

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 建立 API endpoint 呼叫 sync-scaffold.cjs

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/src/modules/flow-tools/api/buildRoutes.ts` | New | BUILD API 路由 |
| `control-tower/src/modules/flow-tools/services/buildService.ts` | New | BUILD 服務邏輯 |

**核心函式**:
1. `syncScaffold(planFile, srcDir?)` - 同步骨架

**API 設計**:
```typescript
POST /api/build/scaffold
{
  "planFile": ".gems/iterations/iter-6/implementation_plan_Story-6.0.md",
  "srcDir": "src"  // optional
}

Response:
{
  "success": true,
  "created": [
    { "path": "src/modules/flow-tools/services/pocService.ts", "gemsCount": 3 }
  ],
  "skipped": [
    { "path": "src/modules/flow-tools/index.ts", "reason": "檔案已存在" }
  ],
  "summary": {
    "totalCreated": 5,
    "totalSkipped": 2,
    "totalGemsTags": 15
  }
}
```

**驗收標準**:
- AC-6.3.8: POST /api/build/scaffold 可正常呼叫
- AC-6.3.9: 產生含 GEMS 標籤的骨架檔案
- AC-6.3.10: 已存在檔案略過不覆蓋
- AC-6.3.11: 回傳新建/略過報告

---

### Item 4: UI 整合

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 整合「Scaffold」按鈕到 UI

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/public/app.js` | Modify | 實作 handleBuildScaffold() |

**核心函式**:
1. `handleBuildScaffold()` - 呼叫 API 並顯示結果

**驗收標準**:
- AC-6.3.12: 點擊「Scaffold」呼叫 API
- AC-6.3.13: 顯示新建/略過報告
- AC-6.3.14: 顯示 GEMS 標籤數量

---

## 5. 規格注入

### 5.1 資料契約 (@GEMS-CONTRACT)

```typescript
// @GEMS-STORY: Story-6.3
// @GEMS-CONTRACT: ScaffoldResult
interface ScaffoldResult {
  success: boolean;
  created: { path: string; gemsCount: number }[];
  skipped: { path: string; reason: string }[];
  summary: {
    totalCreated: number;
    totalSkipped: number;
    totalGemsTags: number;
  }
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
            "name": "api/buildRoutes.ts",
            "type": "route"
          },
          {
            "name": "services/buildService.ts",
            "type": "service",
            "functions": [
              {
                "name": "syncScaffold",
                "priority": "P0",
                "testTypes": ["Unit", "Integration"]
              }
            ]
          }
        ],
        "tests": [
          {
            "name": "services/__tests__/buildService.test.ts",
            "covers": ["syncScaffold"]
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
| sync-scaffold.cjs | internal | 骨架同步工具 |
| code templates | internal | 程式碼樣板 |
| Express | lib | API 框架 |

---

## 8. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **複雜度檢核** | ✅ 通過 | 使用現有工具，無新依賴 |
| **封裝檢核** | ✅ 通過 | Service 層封裝適當 |
| **P0 函式檢核** | ✅ 通過 | 3 個核心函式 |

---

## 9. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| 骨架覆蓋現有檔案 | High | **絕對不覆蓋**，只產生新檔案 |
| fileStructure 解析失敗 | Medium | JSON 格式驗證 |
| 樣板變數替換錯誤 | Medium | 單元測試覆蓋 |

---

**產出日期**: 2025-12-13 | **Agent**: PLAN
