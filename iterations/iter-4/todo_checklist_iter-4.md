# TODO Checklist - iter-4

**迭代**: iter-4  
**Stories**: Story-4.1, Story-4.2, Story-4.3  
**日期**: 2025-12-10  
**目標**: GEMS 專案初始化與腳手架系統

> 📋 **放置位置**: `iterations/iter-4/todo_checklist_iter-4.md`

---

## 📋 執行順序

```
Story-4.1 (專案初始化) → Story-4.2 (腳手架產生) → Story-4.3 (Story 編號判斷)
```

---

## ✅ Story-4.1: 專案初始化模組

### Phase 1: 開發腳本
- [ ] 建立 `tools/init-project.cjs`
- [ ] 實作 `validateProjectPath(path)` - 驗證專案路徑
- [ ] 實作 `checkGemsExists(path)` - 檢查 .gems/ 是否已存在
- [ ] 實作 `copyGemsInfrastructure(sourcePath, targetPath)` - 複製 GEMS 基礎設施
- [ ] 實作 `generateProjectConfig(projectName, projectPath)` - 產生專案配置檔
- [ ] 實作 `createHorizontalLayers(projectPath)` - 產生橫向分層結構
- [ ] 實作 `generateReport(result)` - 產出初始化報告
- [ ] 加入 GEMS 標籤（基礎 + 擴展）

### Phase 2: 測試腳本
- [ ] 建立 `tools/__tests__/init-project.test.cjs`
- [ ] 測試 `validateProjectPath` - 路徑驗證邏輯
- [ ] 測試 `checkGemsExists` - 檢查邏輯
- [ ] 測試 `copyGemsInfrastructure` - 複製邏輯
- [ ] 測試 `generateProjectConfig` - 配置檔產生
- [ ] 測試 `createHorizontalLayers` - 資料夾建立
- [ ] 測試錯誤處理（路徑不存在、權限不足、.gems/ 已存在）

### Phase 3: TDD 測試
- [ ] 執行 `npm test -- init-project.test.cjs`
- [ ] 確認所有測試通過
- [ ] 測試覆蓋率 ≥ 80%

### Phase 4: 標籤驗收
- [ ] 執行 `node tools/gems-scanner.cjs tools --mode validate`
- [ ] 確認所有函式都有 GEMS 標籤
- [ ] 確認 P0 函式有擴展標籤

### Phase 5: Test Gate
- [ ] 執行 `node tools/gems-test-gate.cjs --file=tools/init-project.cjs`
- [ ] 確認 P0 函式都有測試

### Phase 6: 修改檔案測試
- [ ] 執行 `node tools/init-project.cjs --path=./test-project --name=TestProject`
- [ ] 確認 `.gems/` 複製成功
- [ ] 確認 `.gems/config.json` 產生正確
- [ ] 確認橫向分層結構產生正確
- [ ] 測試錯誤情境（路徑不存在、.gems/ 已存在）

### Phase 7: 完成規格
- [ ] 建立 `docs/templates/config.template.json`
- [ ] 更新 `tools/TOOLS_README.md` 加入 init-project.cjs 說明
- [ ] 產出 `Fillback_Story-4.1.md`
- [ ] 產出 `iteration_suggestions_Story-4.1.json`

---

## ✅ Story-4.2: 腳手架產生模組

### Phase 1: 建立 Skeleton Templates
- [ ] 建立 `docs/templates/code/skeleton/` 目錄
- [ ] 建立 `config.skeleton.ts` - Config 空範本
- [ ] 建立 `layout.skeleton.tsx` - Layout 空範本
- [ ] 建立 `component.skeleton.tsx` - Component 空範本
- [ ] 建立 `store.skeleton.ts` - Store 空範本
- [ ] 確認每個 template 包含完整 GEMS 標籤範例
- [ ] 確認每個 template 包含 TODO 註解

### Phase 2: 擴展 scaffold-files.cjs
- [ ] 修改 `tools/scaffold-files.cjs`
- [ ] 實作 `detectMode(planContent)` - 自動偵測模式
- [ ] 實作 `loadSkeletonTemplate(templateType)` - 載入 skeleton template
- [ ] 實作 `generateSkeletonFile(filePath, template, vars)` - 產生 skeleton 檔案
- [ ] 修改 `loadTemplate(templateType, mode)` - 新增 mode 參數
- [ ] 修改 `main()` - 新增 --mode 參數解析
- [ ] 加入 GEMS 標籤（基礎 + 擴展）

### Phase 3: 測試腳本
- [ ] 修改 `tools/__tests__/scaffold-files.test.cjs`
- [ ] 測試 `detectMode` - 模式偵測邏輯
- [ ] 測試 `loadSkeletonTemplate` - skeleton template 載入
- [ ] 測試 `generateSkeletonFile` - skeleton 檔案產生
- [ ] 測試 skeleton mode 完整流程
- [ ] 測試 full mode 完整流程（確保向後相容）
- [ ] 測試自動模式偵測

### Phase 4: TDD 測試
- [ ] 執行 `npm test -- scaffold-files.test.cjs`
- [ ] 確認所有測試通過
- [ ] 測試覆蓋率 ≥ 80%

### Phase 5: 標籤驗收
- [ ] 執行 `node tools/gems-scanner.cjs tools --mode validate`
- [ ] 確認新增函式都有 GEMS 標籤
- [ ] 確認 P0 函式有擴展標籤

### Phase 6: Test Gate
- [ ] 執行 `node tools/gems-test-gate.cjs --file=tools/scaffold-files.cjs`
- [ ] 確認 P0 函式都有測試

### Phase 7: 修改檔案測試
- [ ] 測試 skeleton mode: `node tools/scaffold-files.cjs plan.md --mode=skeleton`
- [ ] 確認產生的檔案只有 GEMS 標籤範例
- [ ] 測試 full mode: `node tools/scaffold-files.cjs plan.md --mode=full`
- [ ] 確認產生的檔案包含函數簽名
- [ ] 測試自動模式偵測
- [ ] 確認向後相容（現有功能不受影響）

### Phase 8: 完成規格
- [ ] 更新 `tools/TOOLS_README.md` 加入 scaffold-files.cjs 新功能說明
- [ ] 產出 `Fillback_Story-4.2.md`
- [ ] 產出 `iteration_suggestions_Story-4.2.json`

---

## ✅ Story-4.3: Story 編號判斷模組

### Phase 1: 開發腳本
- [ ] 建立 `tools/story-number-advisor.cjs`
- [ ] 實作 `detectProjectStructure(projectPath)` - 偵測專案結構
- [ ] 實作 `checkModuleExists(projectPath, moduleName)` - 檢查模組是否存在
- [ ] 實作 `detectArchitectureChange(projectPath, description)` - 偵測架構變更
- [ ] 實作 `suggestStoryNumber(projectPath, moduleName, description)` - 建議 Story 編號
- [ ] 實作 `generateAdviceReport(result)` - 產生建議報告
- [ ] 加入 GEMS 標籤（基礎 + 擴展）

### Phase 2: 測試腳本
- [ ] 建立 `tools/__tests__/story-number-advisor.test.cjs`
- [ ] 測試 `detectProjectStructure` - 專案結構偵測
- [ ] 測試 `checkModuleExists` - 模組檢查邏輯
- [ ] 測試 `detectArchitectureChange` - 架構變更偵測
- [ ] 測試 `suggestStoryNumber` - Story 編號建議邏輯
- [ ] 測試各種情境（新增模組、既有模組、架構變更）

### Phase 3: TDD 測試
- [ ] 執行 `npm test -- story-number-advisor.test.cjs`
- [ ] 確認所有測試通過
- [ ] 測試覆蓋率 ≥ 80%

### Phase 4: 標籤驗收
- [ ] 執行 `node tools/gems-scanner.cjs tools --mode validate`
- [ ] 確認所有函式都有 GEMS 標籤
- [ ] 確認 P1 函式有擴展標籤

### Phase 5: Test Gate
- [ ] 執行 `node tools/gems-test-gate.cjs --file=tools/story-number-advisor.cjs`
- [ ] 確認 P1 函式都有測試

### Phase 6: 修改檔案測試
- [ ] 測試新增模組情境: `node tools/story-number-advisor.cjs --project=./test-project --module=new-module`
- [ ] 確認建議 Story-X.0
- [ ] 測試既有模組情境: `node tools/story-number-advisor.cjs --project=./test-project --module=existing-module`
- [ ] 確認建議 Story-X.1+
- [ ] 測試 JSON 輸出: `node tools/story-number-advisor.cjs --project=./test-project --module=test --json`
- [ ] 測試架構變更偵測

### Phase 7: 完成規格
- [ ] 更新 `tools/TOOLS_README.md` 加入 story-number-advisor.cjs 說明
- [ ] 產出 `Fillback_Story-4.3.md`
- [ ] 產出 `iteration_suggestions_Story-4.3.json`

---

## 🎯 Iteration 完成檢查

### 整合測試
- [ ] 執行完整流程測試：
  1. `node tools/init-project.cjs --path=./test-mms --name=MMS`
  2. `node tools/story-number-advisor.cjs --project=./test-mms --module=meal-management`
  3. 建立 implementation_plan_Story-2.0.md（Module 0）
  4. `node tools/scaffold-files.cjs plan.md --mode=skeleton`
  5. 建立 implementation_plan_Story-2.1.md（Module N）
  6. `node tools/scaffold-files.cjs plan.md --mode=full`
- [ ] 確認所有步驟正常運作
- [ ] 確認產生的檔案結構正確

### 文件更新
- [ ] 更新 `tools/TOOLS_README.md` 包含所有新工具
- [ ] 更新 `docs/guides/story-numbering-guide.md` 加入工具使用範例
- [ ] 產出 `iteration_suggestions_iter-4.json` 整合報告

### SCAN 階段
- [ ] 執行 `node tools/run-all-scanners.cjs tools`
- [ ] 更新 `docs/Full_Project_Spec.md`
- [ ] 更新 `docs/Full_Project_Spec.json`

---

**產出日期**: 2025-12-10 | **Agent**: PLAN
