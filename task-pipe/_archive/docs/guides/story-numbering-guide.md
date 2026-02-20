# GEMS Story 編號規則指南 (Story Numbering Guide)

**版本**: v1.0  
**日期**: 2025-12-10  
**適用階段**: POC, PLAN, BUILD

> 📚 **相關文件**:  
> - [模組化衝刺指南](./modular-sprint-guide.md)  
> - [模組化架構準則](./modular-architecture-guide.md)

---

## 1. 核心理念

**Story 編號反映架構變更的重要性**

- **X.0**: 基礎建設 Story (Infrastructure Story)
- **X.1+**: 功能 Story (Feature Story)

這種編號系統讓 AI 和人類都能立即識別：
- `.0` = 架構變更，需要謹慎處理
- `.1+` = 功能開發，相對安全

---

## 2. Story 編號規則

### 規則 1: 基礎建設 Story (X.0)

**觸發條件** (滿足任一即使用 `.0`):
1. 全新專案初始化
2. 新增模組資料夾 (`src/modules/[new-module]/`)
3. 架構層級調整 (例: 新增 `src/shared/layouts/`)
4. 依賴關係重構

**特徵**:
- Phase 0 會產生「資料夾結構」
- 使用 `module.template` 或 `project.template`
- 產出「架構骨架」，不含完整業務邏輯

**範例**:
```
Story-3.0: Control Tower 基礎建設
  ├─ Phase 0: 產生專案結構
  ├─ Phase 1: 複製 flow/guides/templates/tools
  └─ 產出: 架構骨架

Story-2.0: 用餐管理模組基礎 (Module 1)
  ├─ Phase 0: 產生 src/modules/meal-management/
  └─ 產出: 模組資料夾結構 (api/, hooks/, components/)
```

---

### 規則 2: 功能 Story (X.1, X.2, ...)

**觸發條件**:
- 在既有架構上新增功能
- 不涉及資料夾結構變更
- 只修改或新增檔案內容

**特徵**:
- Phase 0 會產生「功能檔案骨架」
- 使用 `code.template` (service/component/test)
- 產出「可運行的功能」

**範例**:
```
Story-3.1: Prompt 模板系統
  ├─ Phase 0: 產生 promptService.ts, generator.js 骨架
  ├─ Phase 1-6: 完整實作
  └─ 產出: 可運行的 Prompt 產生功能

Story-2.1: 菜單列表功能
  ├─ Phase 0: 產生 MealListPage.tsx, useMealList.ts 骨架
  ├─ Phase 1-6: 完整實作
  └─ 產出: 可運行的菜單列表頁面
```

---

## 3. 判斷流程圖

```
開始新 Story
    ↓
是否需要新增「模組資料夾」？
    ├─ 是 → Story-X.0 (基礎建設)
    │        ├─ 產生模組結構
    │        ├─ 使用 scaffold template
    │        └─ 產出架構骨架
    │
    └─ 否 → 是否需要「架構變更」？
             ├─ 是 → Story-X.0 (架構調整)
             │        └─ 例: 新增 shared/layouts
             │
             └─ 否 → Story-X.1+ (直接開發功能)
                      ├─ 產生功能檔案骨架
                      └─ 完整實作
```

---

## 4. 實際案例分析

### 案例 1: Control Tower 專案

```
Story-3.0: 基礎建設 ✅
  原因: 需要建立整個 control-tower 專案結構
  產出: 
    - control-tower/src/modules/
    - control-tower/flow/
    - control-tower/docs/
    - control-tower/tools/

Story-3.1: Prompt 模板系統 ✅
  原因: 在既有架構上新增功能
  產出: promptService.ts, generator.js

Story-3.2: 節點狀態偵測系統 ✅
  原因: 在既有架構上新增功能
  產出: report-reader.ts, fillback-scanner.ts, status-detector.ts
```

---

### 案例 2: MMS 專案 (假設)

```
Story-1.0: MMS 專案初始化 (Module 0)
  原因: 全新專案，需要建立橫向分層結構
  產出:
    - MMS/src/config/
    - MMS/src/shared/
    - MMS/src/modules/
    - 風格定調 (Theme, Layout)

Story-2.0: 用餐管理模組基礎 (Module 1)
  原因: 需要新增 src/modules/meal-management/
  產出:
    - src/modules/meal-management/
    - 模組資料夾結構 (api/, hooks/, components/)

Story-2.1: 菜單列表功能
  原因: 在 meal-management 模組內新增功能
  產出: MealListPage.tsx, useMealList.ts

Story-2.2: 點餐功能
  原因: 在 meal-management 模組內新增功能
  產出: OrderPage.tsx, useOrder.ts

Story-3.0: 庫存管理模組基礎 (Module 2)
  原因: 需要新增 src/modules/inventory/
  產出:
    - src/modules/inventory/
    - 模組資料夾結構

Story-3.1: 庫存查詢功能
  原因: 在 inventory 模組內新增功能
  產出: InventoryListPage.tsx, useInventory.ts
```

---

## 5. Phase 0 的差異

### Story-X.0 的 Phase 0

**目標**: 產生「模組結構」

```bash
# 使用 scaffold template 產生模組資料夾
node .gems/tools/scaffold-module.cjs \
  --module=meal-management \
  --type=standard  # 或 complex (有 features/)
```

**產出**:
```
src/modules/meal-management/
├── index.ts              # 空範本 (只有 GEMS 標籤)
├── constants.ts          # 空範本
├── types/                # 空資料夾
├── api/                  # 空資料夾
├── hooks/                # 空資料夾
├── services/             # 空資料夾
├── components/           # 空資料夾
└── pages/                # 空資料夾
```

---

### Story-X.1+ 的 Phase 0

**目標**: 產生「功能檔案骨架」

```bash
# 使用 scaffold template 產生功能檔案
node .gems/tools/scaffold-from-plan.cjs \
  --plan=implementation_plan_Story-2.1.md \
  --mode=full
```

**產出**:
```
src/modules/meal-management/
├── pages/
│   └── MealListPage.tsx  # 含函數簽名 + GEMS 標籤
├── hooks/
│   └── useMealList.ts    # 含函數簽名 + GEMS 標籤
└── components/
    └── MealCard.tsx      # 含函數簽名 + GEMS 標籤
```

---

## 6. 編號規則總結表

| 情境 | Story 編號 | Phase 0 產出 | 使用 Template | BUILD 階段 |
|------|-----------|-------------|--------------|-----------|
| 全新專案 | X.0 | 橫向分層結構 | project.template | Phase 0, 1, 7 (簡化) |
| 新增模組 | X.0 | 模組資料夾結構 | module.template | Phase 0, 1, 7 (簡化) |
| 架構調整 | X.0 | 調整後的結構 | - | Phase 0, 1, 7 (簡化) |
| 新增功能 | X.1+ | 功能檔案骨架 | code.template | Phase 0-7 (完整) |

---

## 7. 最佳實踐

### ✅ DO (推薦做法)

1. **明確區分基礎與功能**
   - 新增模組 → 先做 X.0 (基礎)，再做 X.1 (功能)
   - 例: Story-2.0 建立模組結構，Story-2.1 實作第一個功能

2. **保持 .0 的輕量化**
   - Story-X.0 只產生架構骨架，不實作完整邏輯
   - 讓 AI 專注於「結構設計」，而非「業務邏輯」

3. **使用 Template 自動化**
   - 利用 `scaffold-module.cjs` 產生標準結構
   - 確保所有模組遵循相同規範

### ❌ DON'T (避免做法)

1. **不要跳過 .0**
   - ❌ 直接做 Story-2.1，但模組資料夾不存在
   - ✅ 先做 Story-2.0 建立模組，再做 Story-2.1

2. **不要在 .0 實作完整功能**
   - ❌ Story-2.0 包含完整的菜單列表功能
   - ✅ Story-2.0 只建立結構，Story-2.1 實作菜單列表

3. **不要混淆架構與功能**
   - ❌ Story-2.1 同時新增模組資料夾 + 實作功能
   - ✅ 分成兩個 Story: 2.0 (架構) + 2.1 (功能)

---

## 8. 常見問題 (FAQ)

### Q1: 如果只是修改現有檔案，需要新 Story 嗎？

**A**: 視修改範圍而定
- 小修改 (Bug Fix): 不需要新 Story，直接在原 Story 的 Fillback 記錄
- 大修改 (新功能): 需要新 Story-X.N

### Q2: 如果一個模組有多個子功能，如何編號？

**A**: 使用連續編號
```
Story-2.0: 用餐管理模組基礎
Story-2.1: 菜單列表功能
Story-2.2: 點餐功能
Story-2.3: 訂單歷史功能
```

### Q3: 如果需要調整 shared/ 層級，算 X.0 嗎？

**A**: 是的，架構層級調整屬於 X.0
```
Story-4.0: Shared Layouts 擴充
  原因: 新增 src/shared/layouts/DashboardLayout.tsx
  產出: 新的 Layout 範本
```

### Q4: Module 0 (基礎建設) 算 Story-1.0 嗎？

**A**: 是的
```
Story-1.0: 專案初始化 (Module 0)
  產出: 橫向分層結構 + 風格定調

Story-2.0: 第一個業務模組 (Module 1)
  產出: 第一個業務模組結構
```

---

## 9. 與 GEMS Flow 的整合

### POC 階段
- 不區分 .0 或 .1+
- 產出: `requirement_spec_Story-X.X.md`

### PLAN 階段
- 根據需求判斷是否需要 .0
- 在 `implementation_plan_Story-X.X.md` 中標註

### BUILD 階段
- Story-X.0: 執行簡化版 BUILD (Phase 0, 1, 7)
- Story-X.1+: 執行完整版 BUILD (Phase 0-7)

---

**文件版本**: v1.0 | **產出日期**: 2025-12-10
