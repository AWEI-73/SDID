# Implementation Plan 極限完整範例

> 🎯 **目的**: 提供一個「極限完整」的 Implementation Plan 範例，確保通過所有驗證步驟

---

# Implementation Plan - Story-1.0

**迭代**: iter-1  
**Story ID**: Story-1.0  
**日期**: 2026-01-08  
**目標模組**: example-module

---

## 1. Story 目標

**一句話目標**: 建立範例模組的基礎架構與核心功能

**範圍**:
- ✅ 包含: 資料結構、核心邏輯、基礎 UI
- ❌ 不包含: 進階功能、第三方整合

---

## 2. 模組資訊

- **Story 類型**: 
  - [x] **Story-1.0 (Module 0)** - 基礎建設
  - [ ] **Story-X.Y (Module N)** - 業務模組
- **模組名稱**: example-module
- **模組類型**: standard
- **是否新模組**: ✅ 是

---

### 📋 專案類型聲明

**選擇專案類型**:
- [x] **本地專案** (支援資料夾結構，如 React/Vue/Node.js)
- [ ] **雲端專案** (無檔案系統，如 Google Apps Script，使用命名模擬)

---

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | 核心邏輯實作 | FEATURE | P0 | ✅ 明確 | 2-3h |
| 2 | UI 元件開發 | FEATURE | P1 | ✅ 明確 | 3-4h |

**執行順序**: Item 1 → Item 2

---

## 4. Item 詳細規格

### Item 1: 核心邏輯實作

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

**功能描述**: 實作模組的核心業務邏輯

---

#### 📋 GEMS 標籤規格（v2.1）

##### 核心函式: `processData`

**標籤模板**:
```typescript
/**
 * GEMS: processData | P0 | ○○ | (input: DataInput)→DataOutput | Story-1.0 | 處理輸入資料並返回結果
 * GEMS-FLOW: Validate→Transform→Save→Return
 * GEMS-DEPS: [Internal.validateInput (驗證輸入)], [Database.save (儲存資料)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: processData.test.ts
 */
export function processData(input: DataInput): DataOutput {
  // [STEP] Validate - 驗證輸入資料
  if (!input || !input.id) {
    throw new Error('Invalid input');
  }
  
  // [STEP] Transform - 轉換資料格式
  const transformed = {
    id: input.id,
    value: input.value * 2,
    timestamp: Date.now()
  };
  
  // [STEP] Save - 儲存到資料庫
  database.save(transformed);
  
  // [STEP] Return - 返回處理結果
  return transformed;
}
```

**標籤說明**:
- **FLOW 步驟**: Validate → Transform → Save → Return
- **依賴項目**: 
  - `Internal.validateInput`: 內部驗證函式
  - `Database.save`: 資料庫儲存方法
- **測試策略**: Unit（邏輯驗證）+ Integration（資料庫整合測試）

---

##### 輔助函式: `validateInput`

**標籤模板**:
```typescript
/**
 * GEMS: validateInput | P0 | ○○ | (input: DataInput)→boolean | Story-1.0 | 驗證輸入資料格式
 * GEMS-FLOW: CheckNull→CheckType→CheckRange→Return
 * GEMS-DEPS: []
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: validateInput.test.ts
 */
export function validateInput(input: DataInput): boolean {
  // [STEP] CheckNull - 檢查空值
  if (!input) return false;
  
  // [STEP] CheckType - 檢查型別
  if (typeof input.id !== 'string') return false;
  
  // [STEP] CheckRange - 檢查範圍
  if (input.value < 0 || input.value > 100) return false;
  
  // [STEP] Return - 返回驗證結果
  return true;
}
```

**標籤說明**:
- **FLOW 步驟**: CheckNull → CheckType → CheckRange → Return
- **依賴項目**: 無
- **測試策略**: Unit（邊界值測試）

---

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `src/services/dataService.ts` | New | 核心邏輯實作 |
| `src/services/__tests__/dataService.test.ts` | New | Unit Test |
| `src/types/data.ts` | New | 型別定義 |

**驗收標準**:
- AC-1.0.1: processData 能正確處理有效輸入
- AC-1.0.2: validateInput 能正確驗證各種輸入情境
- AC-1.0.3: 錯誤輸入能拋出適當的錯誤訊息

---

### Item 2: UI 元件開發

**Type**: FEATURE  
**Priority**: P1  
**明確度**: ✅ 明確

**功能描述**: 實作使用者介面元件

---

#### 📋 GEMS 標籤規格（v2.1）

##### 核心元件: `DataDisplay`

**標籤模板**:
```typescript
/**
 * GEMS: DataDisplay | P1 | ○○ | (props: DataDisplayProps)→JSX.Element | Story-1.0 | 顯示資料的 UI 元件
 * GEMS-FLOW: InitState→FetchData→RenderUI→HandleEvents
 * GEMS-DEPS: [Service.processData (資料處理)], [Component.Button (按鈕元件)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: DataDisplay.test.tsx
 */
export function DataDisplay(props: DataDisplayProps): JSX.Element {
  // [STEP] InitState - 初始化狀態
  const [data, setData] = useState<DataOutput | null>(null);
  
  // [STEP] FetchData - 取得資料
  useEffect(() => {
    const result = processData(props.input);
    setData(result);
  }, [props.input]);
  
  // [STEP] RenderUI - 渲染介面
  return (
    <div className="data-display">
      {data && <p>Value: {data.value}</p>}
    </div>
  );
  
  // [STEP] HandleEvents - 處理使用者事件（在實際實作中）
}
```

**標籤說明**:
- **FLOW 步驟**: InitState → FetchData → RenderUI → HandleEvents
- **依賴項目**: 
  - `Service.processData`: 資料處理服務
  - `Component.Button`: 共用按鈕元件
- **測試策略**: Unit（元件渲染測試）

---

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `src/components/DataDisplay.tsx` | New | UI 元件實作 |
| `src/components/__tests__/DataDisplay.test.tsx` | New | Component Test |

**驗收標準**:
- AC-1.0.4: 元件能正確顯示資料
- AC-1.0.5: 元件能處理空資料狀態

---

## 5. 規格注入

### 5.1 資料契約 (@GEMS-CONTRACT)

```typescript
// @GEMS-STORY: Story-1.0
// @GEMS-CONTRACT: DataEntity
// @GEMS-TABLE: tbl_data

interface DataInput {
    id: string;           // UUID, PK
    value: number;        // INT, NOT NULL
}

interface DataOutput {
    id: string;           // UUID, PK
    value: number;        // INT, NOT NULL
    timestamp: number;    // TIMESTAMP, NOT NULL
}
```

### 5.2 核心函式規格

```typescript
// @GEMS-FUNCTION: processData
// @GEMS-SIGNATURE: (input: DataInput) → DataOutput
// @GEMS-PRIORITY: P0
// @GEMS-FLOW: Validate→Transform→Save→Return

// @GEMS-FUNCTION: validateInput
// @GEMS-SIGNATURE: (input: DataInput) → boolean
// @GEMS-PRIORITY: P0
// @GEMS-FLOW: CheckNull→CheckType→CheckRange→Return
```

---

## 6. 檔案結構定義

```json
{
  "fileStructure": {
    "modules": [
      {
        "id": "example-module",
        "path": "src",
        "isNew": true,
        "files": [
          {
            "name": "services/dataService.ts",
            "type": "service",
            "functions": [
              {
                "name": "processData",
                "priority": "P0"
              },
              {
                "name": "validateInput",
                "priority": "P0"
              }
            ]
          },
          {
            "name": "components/DataDisplay.tsx",
            "type": "component",
            "functions": [
              {
                "name": "DataDisplay",
                "priority": "P1"
              }
            ]
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
| React | external | UI 框架 |
| LocalStorage | browser | 資料持久化 |

---

## 8. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **模組化結構檢核** | ✅ 通過 | 遵循標準模組結構 |
| **依賴方向檢核** | ✅ 通過 | 依賴方向正確 |
| **模組隔離檢核** | ✅ 通過 | 無循環依賴 |
| **複雜度檢核** | ✅ 通過 | 複雜度適中 |
| **封裝檢核** | ✅ 通過 | 適度封裝 |
| **P0 函式檢核** | ✅ 通過 | P0 函式數量合理 |

---

## 9. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| 資料驗證失敗 | Medium | 加強輸入驗證與錯誤處理 |
| 效能問題 | Low | 初期資料量小，後續可優化 |

---

**產出日期**: 2026-01-08 | **Agent**: PLAN

---

## ✅ 驗證檢查清單

### Step 2 驗證（規格注入）

- [x] Section 1: Story 目標（包含「一句話目標」）
- [x] Section 3: 工作項目表格（包含 Item | Type | Priority）
- [x] Section 5: 規格注入（包含 `@GEMS-CONTRACT` 和 `interface`）

### Step 2.6 驗證（標籤規格）

- [x] Section 4: 每個 Item 都有「📋 GEMS 標籤規格（v2.1）」
- [x] 每個核心函式都有完整的標籤模板：
  - [x] `GEMS: funcName | P0 | ○○ | (args)→Result | Story-1.0 | 描述`
  - [x] `GEMS-FLOW: Step1→Step2→Step3`
  - [x] `GEMS-DEPS: [Type.Name (說明)]`
  - [x] `GEMS-DEPS-RISK: LOW`
  - [x] `GEMS-TEST: ✓ Unit | - Integration | - E2E`
  - [x] `GEMS-TEST-FILE: xxx.test.ts`
- [x] 每個函式都有 `[STEP]` 錨點對應 GEMS-FLOW

---

## 📝 關鍵要點

1. **Section 4 vs Section 5 的差異**:
   - Section 4: 詳細的實作規格（標籤模板 + 程式碼骨架）
   - Section 5: POC 的契約注入（資料結構定義）

2. **標籤模板的位置**:
   - 必須在 Section 4 的每個 Item 裡面
   - 不是在 Section 5

3. **完整性要求**:
   - 每個 P0/P1 函式都必須有完整的 7 行標籤
   - 每個函式都必須有 [STEP] 錨點
   - 覆蓋率必須 >= 80%

---

**最後更新**: 2026-01-08  
**用途**: 作為 Implementation Plan 的「黃金標準」範例
