# Implementation Plan - Story-6.2

**迭代**: iter-6  
**Story ID**: Story-6.2  
**日期**: 2025-12-13  
**目標模組**: flow-tools

> 📋 **放置位置**: `.gems/iterations/iter-6/implementation_plan_Story-6.2.md`

---

## 1. Story 目標

**一句話目標**: 建立 PLAN 樣板產生工具，從 requirement_spec 自動產生 implementation_plan 和 todo_checklist

**範圍**:
- ✅ 包含: generate-plan-templates.cjs 工具、UI 整合、API endpoint
- ❌ 不包含: PLAN 驗證工具（已存在）

---

## 2. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | generate-plan-templates.cjs 工具 | FEATURE | P0 | ✅ 明確 | 已完成 ✅ |
| 2 | PLAN API endpoint | FEATURE | P0 | ✅ 明確 | 2-3h |
| 3 | UI 整合 | FEATURE | P0 | ✅ 明確 | 1-2h |

**執行順序**: Item 1 (已完成) → Item 2 → Item 3

---

## 4. Item 詳細規格

### Item 1: generate-plan-templates.cjs 工具 ✅ 已完成

**Status**: ✅ 已完成  
**檔案**: `control-tower/tools/generate-plan-templates.cjs`

**功能**:
- 解析 requirement_spec 的 Stories 表格
- 產生多個 implementation_plan_Story-X.Y.md
- 產生 todo_checklist_iter-X.md
- 支援 `--output-dir` 參數

---

### Item 2: PLAN API endpoint

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 建立 API endpoint 呼叫 generate-plan-templates.cjs

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/src/modules/flow-tools/api/planRoutes.ts` | New | PLAN API 路由 |
| `control-tower/src/modules/flow-tools/services/planService.ts` | New | PLAN 服務邏輯 |
| `control-tower/src/modules/flow-tools/index.ts` | Modify | 匯出服務 |

**核心函式**:
1. `generatePlanTemplates(specFile, outputDir?)` - 產生 PLAN 樣板

**API 設計**:
```typescript
POST /api/plan/generate-templates
{
  "specFile": ".gems/iterations/iter-6/requirement_spec_iter-6.md",
  "outputDir": ".gems/iterations/iter-6"  // optional
}

Response:
{
  "success": true,
  "iteration": 6,
  "storyCount": 5,
  "createdFiles": [
    "implementation_plan_Story-6.0.md",
    "implementation_plan_Story-6.1.md",
    "implementation_plan_Story-6.2.md",
    "implementation_plan_Story-6.3.md",
    "implementation_plan_Story-6.4.md",
    "todo_checklist_iter-6.md"
  ],
  "outputDir": ".gems/iterations/iter-6"
}
```

**驗收標準**:
- AC-6.2.1: POST /api/plan/generate-templates 可正常呼叫
- AC-6.2.2: 解析 requirement_spec 的 Stories 表格
- AC-6.2.3: 產生對應數量的 implementation_plan
- AC-6.2.4: 產生 todo_checklist
- AC-6.2.5: 回傳產出清單

---

### Item 3: UI 整合

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 整合「產生樣板」按鈕到 UI

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/public/app.js` | Modify | 實作 handlePlanGenerate() |

**核心函式**:
1. `handlePlanGenerate()` - 呼叫 API 並顯示結果

**驗收標準**:
- AC-6.2.6: 點擊「產生樣板」呼叫 API
- AC-6.2.7: 顯示產出檔案清單
- AC-6.2.8: 顯示 Story 數量
- AC-6.2.9: 錯誤處理完善

---

## 5. 規格注入

### 5.1 資料契約 (@GEMS-CONTRACT)

```typescript
// @GEMS-STORY: Story-6.2
// @GEMS-CONTRACT: GeneratePlanResult
interface GeneratePlanResult {
  success: boolean;
  iteration: number;
  storyCount: number;
  createdFiles: string[];
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
            "name": "api/planRoutes.ts",
            "type": "route",
            "functions": [
              {
                "name": "POST /api/plan/generate-templates",
                "priority": "P0",
                "testTypes": ["Integration"]
              }
            ]
          },
          {
            "name": "services/planService.ts",
            "type": "service",
            "functions": [
              {
                "name": "generatePlanTemplates",
                "priority": "P0",
                "testTypes": ["Unit"]
              }
            ]
          }
        ],
        "tests": [
          {
            "name": "services/__tests__/planService.test.ts",
            "covers": ["generatePlanTemplates"]
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
| generate-plan-templates.cjs | internal | PLAN 樣板產生工具 |
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
| requirement_spec 格式錯誤 | Medium | 格式驗證 + 錯誤訊息 |
| Stories 表格解析失敗 | Medium | 正則表達式測試 |

---

**產出日期**: 2025-12-13 | **Agent**: PLAN
