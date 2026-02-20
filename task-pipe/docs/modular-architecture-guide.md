# 完全模組化架構準則 (Modular Architecture Guide)

## 1. 核心理念
**橫向分層 (Horizontal Layers) + 垂直分片 (Vertical Slices) = 可擴展的模組化架構**

目標：
1.  **高內聚**：相關業務邏輯集中在同一模組。
2.  **低耦合**：模組間透過明確介面溝通。
3.  **AI 友善**：結構清晰，讓 AI 助手能準確定位上下文，減少幻覺。

---

## 2. 橫向分層結構 (Horizontal Layers)
專案根目錄結構及其依賴規則：

| 層級 | 目錄名稱 | 職責 | 依賴限制 |
| :--- | :--- | :--- | :--- |
| **1. Config** | `src/config/` | 全域配置 (Env, Constants) | 不可依賴其他層 |
| **2. Assets** | `src/assets/` | 靜態資源 (Images, Fonts, Global Styles) | 不可依賴其他層 |
| **3. Lib** | `src/lib/` | 第三方庫封裝 (Axios, i18n, Date utils) | 僅依賴 Config |
| **4. Shared** | `src/shared/` | 跨模組共用邏輯 | 依賴 Config, Lib, Assets |
| **5. Modules** | `src/modules/` | **核心業務邏輯** (垂直分片) | 依賴 Shared, Config, Lib |
| **6. Routes** | `src/routes/` | 路由定義與導航結構 | 依賴 Modules, Shared |

### Shared 層細分 (`src/shared/`)
- `components/`: 原子元件 (Button, Input, Card)。
- `layouts/`: **頁面佈局** (MainLayout, AuthLayout, DashboardLayout)。
- `hooks/`: 通用 Hooks (useWindowSize, useDebounce)。
- `store/`: **全域狀態** (UserSession, Theme, Toast)。**注意：非跨模組狀態請勿放入。**
- `utils/`: 純函數工具 (formatDate, validateEmail)。

---

## 3. 垂直分片結構 (Modules Layer)
每個模組 (`src/modules/[module-name]/`) 視為一個獨立的微型應用。

### 3.1 標準模組結構
適用於大多數中型模組：

```text
src/modules/meal-management/
├── index.ts           # [重要] 唯一公開 API 入口 (Facade)
├── constants.ts       # 模組內常數 (表單規則、預設值)
├── types/             # 類型定義 (Domain Models & DTOs)
├── api/               # 純後端 API 呼叫 (Fetch/Axios)
├── store/             # 模組狀態 (Zustand/Context) - 如有需要
├── hooks/             # 業務邏輯 Hooks (useMenuCalculation)
├── services/          # 純業務邏輯/資料轉換 (非 React 邏輯)
├── components/        # 模組專用元件
└── pages/             # 路由頁面入口
```

### 3.2 複雜模組結構 (使用 Features 子目錄)

**觸發條件**：當模組內元件/邏輯超過 15-20 個檔案，或職責過於發散時。

```text
src/modules/complex-module/
├── index.ts
├── shared/            # 模組內的共用部分
│   ├── components/
│   └── types/
├── features/          # 子功能拆分
│   ├── sub-feature-a/ # e.g., daily-menu
│   │   ├── components/
│   │   └── hooks/
│   └── sub-feature-b/ # e.g., nutrition-analysis
│       ├── components/
│       └── services/
└── pages/
```

-----

## 4. 關鍵開發規則 (Rules of Play)

### R1: API 與 Service 分離

  - **API (`api/`)**: 只負責 HTTP 請求。處理 Endpoint, Headers, Response Type。
  - **Service (`services/`)**: 負責資料清洗、計算、轉換。
  - **優點**: 方便 Mock API 進行單元測試。

### R2: 嚴格的依賴方向

  - 模組 **不能** 直接導入另一個模組的內部檔案。
  - ❌ `import { Menu } from '../other-module/components/Menu'`
  - ✅ `import { Menu } from '../other-module'` (必須透過 `index.ts` 暴露)
  - 禁止 **循環依賴 (Circular Dependency)**。

### R3: Hooks 優先 (Vibe Coding 模式)

  - 盡量將邏輯從 UI 元件抽離至 `hooks/`。
  - UI 元件應只負責渲染 (Rendering)，邏輯交給 Hook。
  - 這對 AI 生成程式碼最為友善。

### R4: DTO vs Domain Model

  - **DTO**: 後端回傳的原始資料格式 (e.g., `user_id`, `created_at_timestamp`)。
  - **Model**: 前端使用的乾淨格式 (e.g., `userId`, `createdAt`)。
  - 在 `Service` 層或 `API` 層進行轉換，保護 UI 不受後端欄位變更影響。

-----

## 5. GEMS 標籤補充

若使用 `Features` 目錄，建議在 Feature 根目錄加入說明文件，協助 AI 理解上下文。

```typescript
/**
 * GEMS-MODULE: [Module Name]
 * GEMS-FEATURE: [Feature Name]
 * Desc: 負責處理...
 */
```
