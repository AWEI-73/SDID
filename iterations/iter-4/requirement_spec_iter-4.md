# Requirement Spec: iter-4 - GEMS 專案初始化與腳手架系統

> **Iteration**: iter-4  
> **Stories**: Story-4.0, Story-4.1, Story-4.2  
> **Type**: INFRASTRUCTURE  
> **Priority**: P0  
> **Created**: 2025-12-10  
> **Status**: READY FOR POC

---

## 📋 Iteration 概述

### 目標
建立完整的 GEMS 專案初始化與腳手架系統，包含三個獨立模組：
1. **專案初始化模組** (Story-4.0) - 複製 GEMS 基礎設施
2. **腳手架產生模組** (Story-4.1) - 產生檔案骨架
3. **Story 編號判斷模組** (Story-4.2) - 自動判斷 X.0 或 X.1+

### 核心理念
**一個模組一個 Story**，每個 Story 獨立開發、測試、驗收，但在同一個 iteration 完成。

### 背景
目前 GEMS Flow 的問題：
- **手動建立結構**：每次新增模組都要手動建立資料夾和檔案
- **容易遺漏**：忘記建立測試檔案或 index.ts
- **不一致**：不同模組的結構可能不一致
- **AI 猜測**：BUILD 階段 AI 要猜測要建立哪些檔案

現有工具：
- ✅ `init-iteration.cjs` - 初始化迭代資料夾
- ✅ `scaffold-files.cjs` - 根據 implementation_plan 產生檔案骨架

需要新增：
- ❌ 專案初始化工具 - 複製 `.gems/` 到新專案
- ❌ Module 0 支援 - scaffold-files 需支援 skeleton mode
- ❌ Story 編號判斷 - 自動判斷是否需要 X.0

### 核心設計決策
- ✅ **文件先行**：先產生檔案骨架，再由 AI 填充內容
- ✅ **範本驅動**：使用 code template 確保一致性
- ✅ **模組化架構**：遵循 modular-architecture-guide.md
- ✅ **Story 編號自動化**：根據是否新增模組自動判斷 X.0 或 X.1+

### 價值
- ✅ **減少手動工作**：自動產生結構，節省時間
- ✅ **確保一致性**：所有模組遵循相同規範
- ✅ **AI 友善**：AI 知道要填充哪些檔案，不需猜測
- ✅ **可追蹤**：清楚知道哪些檔案是空的，哪些已完成

---

## 🎯 用戶故事

### US-1: 專案初始化
**作為** 開發者  
**我想要** 指定專案路徑並初始化 GEMS  
**以便於** 快速開始使用 GEMS Flow

**驗收標準**:
- Given 我有一個專案路徑（例: `/path/to/MMS`）
- When 我執行 `node .gems/tools/init-project.cjs --path=/path/to/MMS`
- Then 系統自動複製 GEMS 基礎設施到 `MMS/.gems/`
- And 產生專案配置檔 `MMS/.gems/config.json`
- And 產生橫向分層結構（src/config, src/shared, src/modules）

### US-2: Module 0 結構產生
**作為** 開發者  
**我想要** 自動產生 Module 0（基礎建設）的結構  
**以便於** 快速建立專案骨架

**驗收標準**:
- Given 我已完成 Module 0 的 PLAN
- When 我執行 Phase 0 工具
- Then 系統產生橫向分層結構（config, assets, lib, shared, modules, routes）
- And 每個資料夾都有空範本檔案（含 GEMS 標籤）
- And 產生 Theme Config, Layout 範本, 基礎元件範本

### US-3: Module N 結構產生
**作為** 開發者  
**我想要** 根據 implementation_plan 自動產生模組結構  
**以便於** 快速開始開發功能

**驗收標準**:
- Given 我已完成 Module N 的 PLAN（例: Story-2.0 用餐管理）
- When 我執行 `node .gems/tools/scaffold-from-plan.cjs --plan=implementation_plan_Story-2.0.md`
- Then 系統產生模組資料夾（src/modules/meal-management）
- And 產生所有檔案骨架（api/, hooks/, services/, components/, pages/）
- And 每個檔案都有函數簽名 + GEMS 標籤範例

### US-4: Story 編號自動判斷
**作為** 開發者  
**我想要** 系統自動判斷是否需要 X.0  
**以便於** 正確管理 Story 編號

**驗收標準**:
- Given 我要新增一個模組
- When 系統偵測到需要新增模組資料夾
- Then 系統建議使用 Story-X.0（基礎建設）
- And 產生模組結構骨架

- Given 我要在既有模組新增功能
- When 系統偵測到模組資料夾已存在
- Then 系統建議使用 Story-X.1+（功能開發）
- And 產生功能檔案骨架

---

## 🏗️ 技術規格

### 系統架構
```
GEMS 專案初始化系統
├── 專案初始化：複製 GEMS 基礎設施到 .gems/
├── 模組結構產生：根據 PLAN 產生資料夾和檔案
├── 範本填充：使用 code template 產生骨架
└── Story 編號管理：自動判斷 X.0 或 X.1+
```

### 目錄結構

#### 專案初始化後的結構
```
MMS/                          # 專案根目錄
├── .gems/                    # GEMS 基礎設施（從 control-tower 複製）
│   ├── flow/                 # 流程規格
│   ├── prompts/              # 提示詞模板
│   ├── tools/                # 工具腳本
│   ├── docs/                 # 文件與模板
│   ├── iterations/           # 迭代記錄
│   └── config.json           # 專案配置
├── src/                      # 原始碼
│   ├── config/               # 全域配置
│   ├── assets/               # 靜態資源
│   ├── lib/                  # 第三方庫封裝
│   ├── shared/               # 跨模組共用邏輯
│   ├── modules/              # 核心業務邏輯
│   └── routes/               # 路由定義
├── package.json
└── tsconfig.json
```

#### Module 0 產出（基礎建設）
```
src/
├── config/
│   └── env.ts                # 空範本（只有 GEMS 標籤）
├── assets/
│   └── styles/
│       └── globals.css       # Tailwind 基礎配置
├── lib/
│   └── axios.ts              # 空範本
├── shared/
│   ├── components/
│   │   ├── Button.tsx        # 空範本（只有 props 定義）
│   │   └── Card.tsx          # 空範本
│   ├── layouts/
│   │   └── MainLayout.tsx    # 空範本
│   └── store/
│       └── userStore.ts      # 空範本
├── modules/                  # 空資料夾（等 Module N）
└── routes/
    └── index.tsx             # 空範本
```

#### Module N 產出（業務模組）
```
src/modules/meal-management/
├── index.ts                  # 空範本（含 GEMS 標籤）
├── constants.ts              # 空範本
├── types/
│   └── meal.types.ts         # 含 interface 定義 + GEMS 標籤
├── api/
│   └── mealApi.ts            # 含函數簽名 + GEMS 標籤
├── hooks/
│   └── useMealList.ts        # 含函數簽名 + GEMS 標籤
├── services/
│   └── mealService.ts        # 含函數簽名 + GEMS 標籤
├── components/
│   └── MealCard.tsx          # 含函數簽名 + GEMS 標籤
├── pages/
│   └── MealListPage.tsx      # 含函數簽名 + GEMS 標籤
└── __tests__/
    ├── mealApi.test.ts       # 測試範本
    ├── mealService.test.ts   # 測試範本
    └── useMealList.test.ts   # 測試範本
```

### 核心契約

#### ProjectConfig
```typescript
// @GEMS-CONTRACT: ProjectConfig
// @GEMS-TABLE: N/A (配置檔)
interface ProjectConfig {
  projectName: string;      // 專案名稱
  projectPath: string;      // 專案路徑
  gemsVersion: string;      // GEMS 版本
  currentIteration: number; // 當前迭代編號
  currentStory: string;     // 當前 Story ID
  modules: ModuleInfo[];    // 模組清單
}
```

#### ModuleInfo
```typescript
// @GEMS-CONTRACT: ModuleInfo
interface ModuleInfo {
  name: string;             // 模組名稱（例: meal-management）
  type: 'standard' | 'complex'; // 模組類型
  storyId: string;          // 關聯的 Story ID（例: Story-2.0）
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;        // 建立時間
}
```

#### FileScaffold
```typescript
// @GEMS-CONTRACT: FileScaffold
interface FileScaffold {
  path: string;             // 檔案路徑（相對於專案根目錄）
  template: string;         // 使用的範本名稱
  content: string;          // 產生的內容
  variables: Record<string, string>; // 變數替換
}
```

---

## 📦 Stories 分解

### Story-4.0: 專案初始化模組
**Priority**: P0  
**Estimated**: 4-5h  
**Type**: INFRASTRUCTURE  
**Module**: project-init

#### 功能範圍
專案初始化工具，負責複製 GEMS 基礎設施到新專案。

**產出**:
- `tools/init-project.cjs` - 專案初始化工具
- `tools/__tests__/init-project.test.cjs` - 單元測試
- `.gems/config.json` template - 專案配置範本

**功能**:
1. 複製 GEMS 基礎設施到 `.gems/`
2. 產生專案配置檔 `.gems/config.json`
3. 產生橫向分層結構（src/config, src/shared, src/modules）
4. 初始化 package.json（如果不存在）

---

### Story-4.1: 腳手架產生模組
**Priority**: P0  
**Estimated**: 6-7h  
**Type**: INFRASTRUCTURE  
**Module**: scaffold-generator

#### 功能範圍
擴展現有的 `scaffold-files.cjs`，支援 Module 0 和 Module N 的檔案骨架產生。

**產出**:
- `tools/scaffold-files.cjs` - 擴展現有工具
- `docs/templates/code/skeleton/*.skeleton.*` - Skeleton templates
- `tools/__tests__/scaffold-files.test.cjs` - 更新測試

**功能**:
1. 新增 `--mode=skeleton` 支援 Module 0
2. 新增 `--mode=full` 支援 Module N（現有功能增強）
3. 支援從 implementation_plan 解析模組類型
4. 自動判斷使用哪種 template
5. 建立 Skeleton templates（config, layout, component, store）

---

### Story-4.2: Story 編號判斷模組
**Priority**: P1  
**Estimated**: 3-4h  
**Type**: INFRASTRUCTURE  
**Module**: story-advisor

#### 功能範圍
自動判斷是否需要 X.0（基礎建設）或 X.1+（功能開發）。

**產出**:
- `tools/story-number-advisor.cjs` - Story 編號判斷工具
- `tools/__tests__/story-number-advisor.test.cjs` - 單元測試

**功能**:
1. 偵測專案結構
2. 判斷是否需要新增模組資料夾
3. 建議使用 X.0 或 X.1+
4. 產生建議報告（包含理由）

---

## 🔄 Story 執行順序

```
Story-4.0 (專案初始化) → Story-4.1 (腳手架產生) → Story-4.2 (Story 編號判斷)
     ↓                          ↓                          ↓
  獨立測試                    獨立測試                    獨立測試
     ↓                          ↓                          ↓
  獨立驗收                    獨立驗收                    獨立驗收
```

**原則**:
- 每個 Story 獨立開發、測試、驗收
- Story-4.0 完成後才開始 Story-4.1
- Story-4.1 完成後才開始 Story-4.2
- 所有 Story 在 iter-4 完成

---

## 🔗 依賴關係

### 前置依賴
- ✅ modular-architecture-guide.md (已完成)
- ✅ modular-sprint-guide.md (已完成)
- ✅ story-numbering-guide.md (已完成)
- ✅ code templates (已完成)

### 後續依賴
- ⏳ 多專案管理 (iter-5)
- ⏳ 備份管理 (iter-5)

---

## 🧪 測試策略

### 單元測試
- 專案初始化邏輯測試
  - 測試檔案複製
  - 測試配置檔產生
  - 測試錯誤處理
- 模組結構產生測試
  - 測試資料夾建立
  - 測試檔案產生
  - 測試範本填充
- Story 編號判斷測試
  - 測試 X.0 判斷邏輯
  - 測試 X.1+ 判斷邏輯

### 整合測試
- 完整流程測試
  - 初始化專案
  - 產生 Module 0
  - 產生 Module N
  - 驗證結構正確

### 手動測試
- 使用 MMS 專案測試
  - 初始化 MMS 專案
  - 產生 Module 0（基礎建設）
  - 產生 Module 1（用餐管理）
  - 驗證所有檔案正確產生

### 測試覆蓋率目標
- 單元測試覆蓋率 ≥ 80%
- 核心邏輯覆蓋率 ≥ 90%
- 所有 AC 通過

---

## 📊 完成標準

### Definition of Done
- [ ] 所有 AC 通過
- [ ] 測試覆蓋率 ≥ 80%
- [ ] 測試通過率 100%
- [ ] 程式碼有 GEMS 標籤
- [ ] 文件完整
- [ ] 工具可正常運行

### 驗證方式
```bash
# 1. 專案初始化
node tools/init-project.cjs --path=/path/to/MMS --name=MMS

# 2. Module 0 結構產生（skeleton mode）
node tools/scaffold-files.cjs \
  --plan=iterations/iter-1/implementation_plan_Story-1.0.md \
  --mode=skeleton

# 3. Module N 結構產生（full mode）
node tools/scaffold-files.cjs \
  --plan=iterations/iter-2/implementation_plan_Story-2.0.md \
  --mode=full

# 4. Story 編號建議
node tools/story-number-advisor.cjs \
  --project=/path/to/MMS \
  --module=meal-management

# 5. 執行測試
npm test -- init-project.test.cjs
npm test -- story-number-advisor.test.cjs
npm test -- scaffold-files.test.cjs
```

---

## 📝 備註

### 設計決策
1. **文件先行**：先產生檔案骨架，再由 AI 填充內容
2. **範本驅動**：使用 code template 確保結構一致
3. **模組化架構**：遵循 modular-architecture-guide.md
4. **Story 編號自動化**：根據是否新增模組自動判斷 X.0 或 X.1+

### 已知限制
- 目前只支援 TypeScript/React 專案
- 需要手動執行工具（未來可整合到 Control Tower UI）

### 未來改進
- 支援更多專案類型（Vue, Angular）
- 整合到 Control Tower UI
- 支援自訂 template
- 支援 template 版本管理

---

**Status**: 📝 READY FOR POC  
**Next Step**: 進入 POC 階段，設計工具原型

