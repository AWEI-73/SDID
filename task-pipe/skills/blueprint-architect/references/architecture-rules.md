# 模組化架構規則

## 橫向分層 (6 層)

| 層級 | 目錄 | 職責 | 依賴限制 |
|------|------|------|---------|
| 1. Config | src/config/ | 全域配置 (Env, Constants) | 不可依賴其他層 |
| 2. Assets | src/assets/ | 靜態資源 | 不可依賴其他層 |
| 3. Lib | src/lib/ | 第三方庫封裝 (Axios, DB Client) | 僅依賴 Config |
| 4. Shared | src/shared/ | 跨模組共用邏輯 | 依賴 Config, Lib, Assets |
| 5. Modules | src/modules/ | 核心業務 (垂直分片) | 依賴 Shared, Config, Lib |
| 6. Routes | src/routes/ | 路由定義 | 依賴 Modules, Shared |

## Shared 層細分 (src/shared/)

- `components/` — 原子元件 (Button, Input, Card)
- `layouts/` — 頁面佈局 (MainLayout, AuthLayout)
- `hooks/` — 通用 Hooks (useDebounce, useWindowSize)
- `store/` — 全域狀態 (UserSession, Theme) — 非跨模組狀態勿放入
- `utils/` — 純函數工具 (formatDate, validateEmail)
- `types/` — 共用型別定義

## 標準模組內部結構

```
src/modules/{name}/
├── index.ts        → 唯一公開 API 入口 (Facade)
├── constants.ts    → 模組內常數
├── types/          → Domain Models & DTOs
├── api/            → 純 HTTP 請求 (DTO 接收)
├── services/       → 純業務邏輯/資料轉換 (非 React)
├── hooks/          → 業務邏輯 Hooks
├── components/     → 模組專用元件
└── pages/          → 路由頁面入口
```

## 依賴規則

- ✅ 模組可依賴: shared, config, lib
- ❌ 禁止: `import { X } from '../other-module/components/X'` (直接 import 內部檔案)
- ✅ 正確: `import { X } from '../other-module'` (透過 index.ts Facade)
- ❌ 禁止: 循環依賴

## 關鍵開發規則

| 規則 | 說明 |
|------|------|
| R1 API/Service 分離 | API 只管 HTTP 請求，Service 管資料清洗/計算/轉換 → 方便 Mock 測試 |
| R2 DTO vs Domain Model | 後端 DTO (user_id) 在 Service 層轉為前端 Model (userId) |
| R3 Hooks 優先 | 邏輯從 UI 抽離至 hooks/，UI 只負責渲染 → AI 生成最友善 |
| R4 複雜模組 | >15 檔案時加 features/ 子目錄拆分子功能 |

## 路由結構範例

```
src/
├── config/          → 全域配置
├── lib/             → 第三方庫封裝
├── shared/          → 跨模組共用
│   ├── components/
│   ├── layouts/
│   ├── hooks/
│   ├── store/
│   ├── utils/
│   └── types/
├── modules/         → 核心業務
│   ├── {moduleA}/
│   └── {moduleB}/
├── routes/          → 路由定義
└── index.ts         → 應用入口
```
