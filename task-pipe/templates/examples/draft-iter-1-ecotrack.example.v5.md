# Draft iter-1: shared

**迭代**: iter-1
**模組**: shared
**目標**: 核心型別 + API 介面契約 + 排放係數種子資料 + 前端路由殼
**依賴**: 無

<!--
  @CONTEXT_SCOPE:
    READ: blueprint.md
    SKIP: 無前置 iter
-->

---

## Story 拆法

> Story-0.0: Foundation — 專案骨架 + 核心型別 + 環境配置 + 路由框架

## 動作清單

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | AC |
|---------|------|---------|-----------|---|------|------|----|
| 核心型別定義 | CONST | CoreTypes | N/A | P0 | DEFINE→FREEZE→EXPORT | 無 | AC-0.0 [SKIP] |
| 環境變數管理 | CONST | ENV_CONFIG | N/A | P2 | LOAD→VALIDATE→EXPORT | 無 | - |
| API 介面契約 | CONST | IServiceContracts | N/A | P1 | DEFINE→VALIDATE→EXPORT | [Internal.CoreTypes] | AC-0.1 [SKIP] |
| 前端主入口殼 | ROUTE | AppRouter | N/A | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [Internal.CoreTypes] | AC-0.2 [MANUAL] |

## AC 骨架

- AC-0.0 [SKIP] — CoreTypes: Given 專案已初始化 / When `tsc --noEmit` / Then 編譯成功，無型別錯誤
- AC-0.1 [SKIP] — IServiceContracts: Given 已定義介面 / When `implements IDataEntryService` / Then TS 強制實作所有方法
- AC-0.2 [MANUAL] — AppRouter: Given `npm run dev` / When 開啟 localhost / Then 首頁框架可見，無 console error

## 模組 API 摘要

- 對外 API: CoreTypes (type export), EmissionScope, RecordStatus, ENV_CONFIG, IDataEntryService, IDashboardService
- 內部依賴: 無
