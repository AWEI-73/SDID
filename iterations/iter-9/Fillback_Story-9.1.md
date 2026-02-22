# Fillback Story-9.1: System Blueprint Visualizer

## 基本資訊
- **Iteration**: iter-9
- **Story**: Story-9.1 System Blueprint Visualizer
- **模組**: viz (Visualizer)
- **Type**: FEATURE
- **Priority**: P0
- **Status**: Partial (Item 1 Completed)
- **Date**: 2025-12-18

## 開發 Log

### Item 1: 建立 Spec Aggregator 工具 ✅

- [x] Phase 1: 開發腳本
  - 建立 `tools/spec-aggregator.cjs` (工具版本 - 獨立完整)
  - 建立 `src/modules/viz/services/blueprintAggregator.ts` (模組版本 - 獨立完整)
  - 實作 12 個函式，包含 2 個 P0、7 個 P1、3 個 P2
  - 所有函式都有完整 GEMS v2.1 標籤（FLOW + [STEP] 錨點）

- [x] Phase 2: 測試腳本
  - 建立 `tools/__tests__/spec-aggregator.test.cjs`
  - 涵蓋所有 P0/P1 函式的 Unit 測試

- [x] Phase 3: TDD 測試
  - ✅ 20/20 測試通過
  - ✅ 100% 通過率

- [x] Phase 4: 標籤驗收
  - ✅ 手動驗證所有 GEMS 標籤完整性
  - ✅ FLOW 與 [STEP] 錨點 100% 對應

- [x] Phase 5: Test Gate
  - ✅ P0/P1 函式都有對應測試檔案

- [x] Phase 6: 修改檔案測試驗證
  - ✅ 新建檔案，無需驗證

- [x] Phase 6.5: 整合檢查
  - ✅ TypeScript 型別檢查通過 (0 errors)
  - ✅ 無需更新 package.json（無新依賴）
  - ✅ 無需更新路由（工具腳本）
  - ✅ 無需更新模組匯出（獨立工具）

### Item 2: 實作 Blueprint API ⏳

- [ ] 待開始

### Item 3: 前端整合 Blueprint UI ⏳

- [ ] 待開始

## 技術細節

### Spec Aggregator 設計

**雙版本架構**：
- **工具版本** (`tools/spec-aggregator.cjs`): 獨立 CLI 工具，可直接執行
- **模組版本** (`src/modules/viz/services/blueprintAggregator.ts`): TypeScript 模組，供 API 使用
- 兩者功能相同，完全獨立，不互相依賴

**核心功能**：
- 讀取 4 個 Scanner 產出檔案（structure.json, config.json, Full_Project_Spec.json, schema.json）
- 整合為統一的 `system-blueprint.json`
- 支援 Database Schema 可選（若不存在不報錯）

**資料結構**：
```typescript
interface SystemNode {
  name: string;
  type: 'project' | 'database' | 'module' | 'script' | 'function' | 'config-group';
  stats?: { modules, scripts, functions, tables };
  config?: { constants, hardcoded };
  tables?: DatabaseTable[];
  erDiagram?: string;
  functions?: FunctionNode[];
  children?: SystemNode[];
}
```

**架構決策**：
1. 使用遞迴結構支援無限層級
2. Database 節點包含 Mermaid ER Diagram
3. 函式資料從 Full_Project_Spec.json 提取並合併到對應 Script

## 測試結果

- **Unit Test**: 20/20 通過
- **Integration Test**: N/A (工具腳本)
- **E2E Test**: N/A (工具腳本)
- **Coverage**: 100% (所有主要函式)

## 產出檔案

- `tools/spec-aggregator.cjs` - Spec Aggregator 工具版本（獨立 CLI）
- `src/modules/viz/services/blueprintAggregator.ts` - Spec Aggregator 模組版本（TypeScript）
- `tools/__tests__/spec-aggregator.test.cjs` - Unit 測試

## 下一步建議

繼續 Story-9.1 的 Item 2: 實作 Blueprint API
