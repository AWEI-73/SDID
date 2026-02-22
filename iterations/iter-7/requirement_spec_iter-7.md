# Requirement Specification - Iteration 7

**迭代編號**: iter-7  
**迭代目標**: Control Tower 模組化重構 - Phase 1 (基礎建設 & POC)  
**日期**: 2025-12-15  
**類型**: REFACTOR / INFRASTRUCTURE

---

## 1. 迭代目標

**一句話目標**: 建立 GEMS Modular Architecture v2.0 的基礎設施，並完成第一個垂直切片 (Viewing Slice) —— POC 模組的遷移與驗證。

**背景**:
依據 `GEMS_Control_Tower_Analysis_Report.md`，專案需要轉型為領域驅動的模組化架構。為降低風險，本迭代採取「保守漸進」策略，不求一次到位，而是先將地基打好並驗證一個完整模組。

**範圍**:
- ✅ **Infrastructure**: 建立 Config, Lib, Shared, Hub 層。
- ✅ **Domain**: 完整遷移 POC 模組 (由 `flow-tools` + `tools/*.cjs` 轉型)。
- ✅ **Testing**: 更新並通過 POC 模組的相關測試。
- ❌ **Out of Scope**: PLAN, BUILD, SCAN 等其他模組的遷移（留待 iter-8）。

---

## 2. Story 清單

### Story-7.0: 基礎設施層建立 (Phase 0)

**優先級**: P0  
**預估工時**: 2-3h  
**類型**: INFRASTRUCTURE

**目標**: 
建立支撐模組化架構的底層結構，消除循環依賴，提供統一的工具庫。

**具體工作**:
1.  **Config Layer**: 建立 `src/config` (env, constants, paths)。
2.  **Lib Layer**: 建立 `src/lib`，封裝 `fs`, `child_process`, `path` 等底層操作。
3.  **Shared Layer**: 建立 `src/shared`，包含 `types` (GEMS/Common) 與 `utils`。
4.  **Hub Core**: 建立 `src/shared/hub`，包含 `metadata` (重構原 `flow/`, `prompts/`) 與 `orchestrator` 骨架。

**驗收標準**:
- AC-7.0.1: 新目錄結構建立完成且編譯無誤。
- AC-7.0.2: `src/config` 能正確讀取環境變數與路徑。
- AC-7.0.3: `src/shared/hub` 能正確存取原有的 `flow` 定義。

---

### Story-7.1: POC 模組遷移 (Phase 1)

**優先級**: P0  
**預估工時**: 3-4h  
**類型**: REFACTOR

**目標**: 
將 POC 相關的功能從 `tools/*.cjs` 與 `flow-tools` 剝離，整合進 `src/modules/poc`，成為第一個標準化的垂直模組。

**具體工作**:
1.  **Module Structure**: 建立 `src/modules/poc` 目錄結構 (index, api, services, tools, types)。
2.  **Tool Migration**:
    - 將 `tools/init-poc.cjs` 重構為 `src/modules/poc/tools/init-poc.ts`。
    - 將 `tools/html-poc-parser.cjs` 重構為 TypeScript 版本。
    - 將 `tools/html-poc-to-spec.cjs` 重構為 TypeScript 版本。
    - 將 `tools/process-html-poc.cjs` 重構為 TypeScript 版本。
3.  **Service Refactor**: 重寫 `pocService.ts`，直接呼叫內部 tools 而非 `execSync`。
4.  **API Route**: 更新 `pocRoutes.ts` 指向新的 Service。
5.  **Expose Interface**: 在 `index.ts` 定義清晰的公開介面。

**驗收標準**:
- AC-7.1.1: `src/modules/poc` 獨立運作，不依賴 legacy tools。
- AC-7.1.2: 能夠透過 API 成功執行「初始化 POC」流程。
- AC-7.1.3: 能夠正確解析 HTML POC 並生成規格文件。
- AC-7.1.4: 程式碼通過 TypeScript 檢查，無 `any` 濫用。

---

### Story-7.2: 測試與驗證

**優先級**: P1  
**預估工時**: 1-2h  
**類型**: QUALITY

**目標**: 
確保重構後的 POC 模組功能正確，且不影響現有系統運作。

**具體工作**:
1.  **Unit Test**: 為新的 `init-poc.ts` 等工具撰寫單元測試。
2.  **Service Test**: 更新 `pocService.test.ts` 引用路徑並驗證邏輯。
3.  **Integration Check**: 確認 Hub 能正確呼叫新的 POC 模組。

**驗收標準**:
- AC-7.2.1: 所有 POC 相關測試案例 Pass。
- AC-7.2.2: 執行 `npm run dev` 啟動無報錯。

---

## 3. 技術規格範例 (v2.0)

### 模組目錄結構 (src/modules/poc/)
```text
src/modules/poc/
├── index.ts           # 公開入口 (Exports)
├── api/               # API Controllers
├── services/          # Business Logic
├── tools/             # Core Implementation (Converted from CLI)
├── types/             # Module specific types
└── __tests__/         # Tests
```

### 工具引用方式改變
**Before**:
```typescript
execSync(`node tools/init-poc.cjs --project ${path}`)
```

**After**:
```typescript
import { initPoc } from './tools/init-poc';
await initPoc({ projectPath: path });
```

---

## 4. 依賴關係與順序

1.  **Story-7.0 (Base)**: 必須最先完成，所有模組都依賴它。
2.  **Story-7.1 (POC Migration)**: 依賴 Story-7.0。
3.  **Story-7.2 (Verify)**: 依賴 Story-7.1。

---

## 5. 驗收計畫

本迭代完成後，系統將處於「混合狀態」：
- **POC 功能**: 運行在 v2.0 架構上 (TypeScript, Module-based)。
- **PLAN/BUILD/SCAN**: 暫時維持 v1.0 架構 (CLI-based)，但在下個迭代遷移。

**重點驗證**:
- 確認 POC Flow (Init -> HTML -> Spec) 運作正常。
- 確認系統整體未發生 Regression。

---

**規格產出日期**: 2025-12-15  
**規格產出者**: Architect Agent  
**審核狀態**: ✅ 已確認
