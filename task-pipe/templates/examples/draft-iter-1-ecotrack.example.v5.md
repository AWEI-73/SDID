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

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | TDD |
|---------|------|---------|-----------|---|------|------|-----|
| 核心型別定義 | CONST | CoreTypes | N/A | P0 | DEFINE→FREEZE→EXPORT | 無 | [DB] |
| 環境變數管理 | CONST | ENV_CONFIG | N/A | P2 | LOAD→VALIDATE→EXPORT | 無 | [DB] |
| API 介面契約 | CONST | IServiceContracts | N/A | P1 | DEFINE→VALIDATE→EXPORT | [Internal.CoreTypes] | [DB] |
| 前端主入口殼 | ROUTE | AppRouter | N/A | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [Internal.CoreTypes] | [UI] |

## TDD 測試需求

<!-- iter-1 為 Foundation（型別定義層），所有 action 為 [DB]/[UI]，無 [TDD] → Phase 2 只跑 tsc --noEmit -->

## 模組 API 摘要

- 對外 API: CoreTypes (type export), EmissionScope, RecordStatus, ENV_CONFIG, IDataEntryService, IDashboardService
- 內部依賴: 無
