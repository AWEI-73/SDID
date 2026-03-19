/**
 * @GEMS-CONTRACT-VERSION: 2.0
 * @GEMS-ITER: iter-1
 * @GEMS-PROJECT: EcoTrack
 * @GEMS-ROUTE: Blueprint
 *
 * Blueprint Contract v2.0 — 單一規格來源 (Single Source of Truth)
 *
 * 此檔案是 plan-generator 的唯一輸入。
 * AI 從 enhanced-draft 推導寫出，contract-writer gate 驗格式。
 * plan-generator 直讀 @GEMS-STORIES → 機械分片為 implementation_plan。
 *
 * 標籤清單:
 *   @GEMS-STORIES         — Story 清單（plan-generator 直讀）
 *   @GEMS-STORY-ITEM      — 每個 Story 的動作清單
 *   @GEMS-CONTRACT        — Entity 定義（後端邊界）
 *   @GEMS-TABLE           — DB 表對應（warning not blocker）
 *   @GEMS-VIEW            — 前端 View 型別
 *   @GEMS-API             — 公開 API 簽名
 *   @GEMS-ENUM            — 列舉型別
 *   @GEMS-TDD             — 指向測試檔路徑（Phase 2 執行 vitest，純計算/業務邏輯才加）
 *
 * Gate 規則 (contract-gate.cjs v5):
 *   CG-001: 必須有 @GEMS-STORY: 單行格式
 *   CG-002: 必須有 @GEMS-CONTRACT: EntityName
 *   @GUIDED CG-G01: @GEMS-TDD 路徑格式建議（src/ 開頭，.test.ts 結尾）
 *   @GUIDED CG-G04: @GEMS-AC-* 標籤已 deprecated，請改用 @GEMS-TDD
 */

// @CONTRACT-LOCK: 2026-01-15 | Gate: iter-1
//
// ─── 以下契約已通過 Gate，修改需加 [SPEC-FIX] 標記 ──────────────────────────

// ─── Stories ─────────────────────────────────────────────────

// @GEMS-STORIES
// Story-0.0 | 專案骨架 + 核心型別 | Foundation
// Story-1.0 | 組織管理 CRUD | CRUD
// Story-2.0 | 碳排資料登錄 | CRUD + CALC
// Story-3.0 | 儀表板統計 | READ + CALC

// ─── Story Items ─────────────────────────────────────────────

// @GEMS-STORY-ITEM: Story-0.0
// - 建立專案骨架與目錄結構 | CREATE | P0
// - 定義核心型別 (Organization, EmissionRecord, EmissionFactor) | CREATE | P0
// - 設定環境變數管理 | CREATE | P2
// - 設定路由框架 (AppRouter) | CREATE | P1

// @GEMS-STORY-ITEM: Story-1.0
// - 組織列表頁面 | CREATE | P1
// - 新增組織功能 | CREATE | P1
// - 編輯組織功能 | MODIFY | P1

// @GEMS-STORY-ITEM: Story-2.0
// - 碳排資料輸入表單 | CREATE | P1
// - 排放係數查詢 | READ | P1
// - CO2e 自動計算 | CALC | P0

// @GEMS-STORY-ITEM: Story-3.0
// - Scope 分類統計 | READ + CALC | P1
// - 月趨勢圖表 | READ | P2

// ─── Enums ───────────────────────────────────────────────────

// @GEMS-ENUM: EmissionScope
export type EmissionScope = 'SCOPE1' | 'SCOPE2' | 'SCOPE3';

// @GEMS-ENUM: RecordStatus
export type RecordStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

// ─── Entities（後端邊界，對應 DB） ────────────────────────────

// @GEMS-CONTRACT: Organization
// @GEMS-TABLE: tbl_organizations
// @GEMS-STORY: Story-1.0
export interface Organization {
  id: string;           // UUID, PK
  name: string;         // VARCHAR(200), NOT NULL
  industry: string;     // VARCHAR(100), NOT NULL
  reportYear: number;   // INT, NOT NULL
  createdAt: Date;      // TIMESTAMP, NOT NULL
}

// @GEMS-CONTRACT: EmissionRecord
// @GEMS-TABLE: tbl_emission_records
// @GEMS-STORY: Story-2.0
export interface EmissionRecord {
  id: string;           // UUID, PK
  orgId: string;        // UUID, FK → tbl_organizations.id
  scope: EmissionScope; // ENUM('SCOPE1','SCOPE2','SCOPE3'), NOT NULL
  category: string;     // VARCHAR(100), NOT NULL
  amount: number;       // DECIMAL(12,4), NOT NULL, >= 0
  unit: string;         // VARCHAR(20), NOT NULL
  factorId: string;     // UUID, FK → tbl_emission_factors.id
  co2e: number;         // DECIMAL(12,4), COMPUTED
  period: string;       // VARCHAR(7), NOT NULL (YYYY-MM)
  status: RecordStatus; // ENUM('DRAFT','SUBMITTED','APPROVED'), DEFAULT 'DRAFT'
}

// @GEMS-CONTRACT: EmissionFactor
// @GEMS-TABLE: tbl_emission_factors
// @GEMS-STORY: Story-0.0
export interface EmissionFactor {
  id: string;           // UUID, PK
  name: string;         // VARCHAR(100), NOT NULL
  category: string;     // VARCHAR(50), NOT NULL
  value: number;        // DECIMAL(10,6), NOT NULL, >= 0
  unit: string;         // VARCHAR(30), NOT NULL
  source: string;       // VARCHAR(100), NOT NULL
  year: number;         // INT, NOT NULL
}

// ─── Views（前端邊界） ───────────────────────────────────────

// @GEMS-VIEW: OrganizationView
// @GEMS-FIELD-COVERAGE: id=frontend, name=frontend, industry=frontend, reportYear=frontend, createdAt=api-only
export interface OrganizationView {
  id: string;
  name: string;
  industry: string;
  reportYear: number;
}

// @GEMS-VIEW: EmissionRecordView
// @GEMS-FIELD-COVERAGE: id=frontend, scope=frontend, category=frontend, amount=frontend, unit=frontend, co2e=frontend, period=frontend, status=frontend, factorId=api-only, orgId=api-only
export interface EmissionRecordView {
  id: string;
  scope: EmissionScope;
  category: string;
  amount: number;
  unit: string;
  co2e: number;
  period: string;
  status: RecordStatus;
}

// ─── API 簽名（公開介面契約） ─────────────────────────────────

// @GEMS-API: IDataEntryService
// @GEMS-STORY: Story-2.0
export interface IDataEntryService {
  createRecord(data: Omit<EmissionRecord, 'id' | 'co2e'>): Promise<EmissionRecord>;
  getRecords(orgId: string, period: string): Promise<EmissionRecord[]>;
  calcEmission(amount: number, factorId: string): number;
}

// @GEMS-API: IDashboardService
// @GEMS-STORY: Story-3.0
export interface IDashboardService {
  getScopeSummary(orgId: string, year: number): Promise<Record<EmissionScope, number>>;
  getTrendData(orgId: string, months: number): Promise<Array<{ month: string; totalCo2e: number }>>;
}

// ─── TDD 測試路徑（v7.0）────────────────────────────────────
// 純計算/業務邏輯（CYNEFIN needsTest:true）才加 @GEMS-TDD
// DB CRUD / UI / 外部 API 不加（Phase 2 只跑 tsc --noEmit）

// Story-2.0 calcEmission 是純計算（Complicated），加 @GEMS-TDD
// @GEMS-STORY: Story-2.0 | DataEntry | 碳排資料登錄 | CRUD+CALC
// @GEMS-TDD: src/modules/DataEntry/lib/__tests__/calc-emission.test.ts

// Story-3.0 getScopeSummary 需要 DB，不加 @GEMS-TDD（tsc only）
// @GEMS-STORY: Story-3.0 | Dashboard | 儀表板統計 | READ+CALC

// Story-1.0 UI 層，不加 @GEMS-TDD
// @GEMS-STORY: Story-1.0 | shared | 組織管理 CRUD | CRUD

// Story-0.0 Foundation（型別定義），不加 @GEMS-TDD
// @GEMS-STORY: Story-0.0 | shared | 專案骨架 + 核心型別 | Foundation
