/**
 * @GEMS-CONTRACT-VERSION: 3.0
 * @GEMS-ITER: iter-1
 * @GEMS-PROJECT: EcoTrack
 * @GEMS-ROUTE: Blueprint
 *
 * Contract v3 — iter-1 shared 模組
 *
 * @CONTEXT_SCOPE:
 *   BUILD_READ: contract_iter-1.ts, implementation_plan_Story-0.0.md
 *   BUILD_REF:  blueprint.md#實體定義
 *   BUILD_SKIP: draft_iter-1.md
 */

// @CONTRACT-LOCK: 2026-03-13 | Gate: iter-1
// @SPEC-CHANGES: (none)
//
// ─── 以下契約已通過 Gate，修改需加 [SPEC-FIX] 標記 ──────────────────────────

// ─── Stories ─────────────────────────────────────────────────

// @GEMS-STORY: Story-0.0 | shared | 專案骨架 + 核心型別 + 環境配置 + 路由框架 | Foundation
// @GEMS-STORY-ITEM: CoreTypes | CONST | P0 | DEFINE→FREEZE→EXPORT | 無
// @GEMS-STORY-ITEM: ENV_CONFIG | CONST | P2 | LOAD→VALIDATE→EXPORT | 無
// @GEMS-STORY-ITEM: IServiceContracts | CONST | P1 | DEFINE→VALIDATE→EXPORT | [CoreTypes]
// @GEMS-STORY-ITEM: AppRouter | ROUTE | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [CoreTypes]

// ─── Enums ───────────────────────────────────────────────────

// @GEMS-ENUM: EmissionScope
export type EmissionScope = 'SCOPE1' | 'SCOPE2' | 'SCOPE3';

// @GEMS-ENUM: RecordStatus
export type RecordStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

// ─── Entities（後端邊界，對應 DB）────────────────────────────

// @GEMS-CONTRACT: Organization
// @GEMS-TABLE: tbl_organizations
// @GEMS-STORY: Story-0.0
export interface Organization {
  id: string;           // UUID, PK
  name: string;         // VARCHAR(200), NOT NULL
  industry: string;     // VARCHAR(100), NOT NULL
  reportYear: number;   // INT, NOT NULL
  createdAt: Date;      // TIMESTAMP, NOT NULL
}

// @GEMS-CONTRACT: EmissionRecord
// @GEMS-TABLE: tbl_emission_records
// @GEMS-STORY: Story-0.0
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

// ─── Views（前端邊界）───────────────────────────────────────

// @GEMS-VIEW: OrganizationView
export interface OrganizationView {
  id: string;
  name: string;
  industry: string;
  reportYear: number;
}

// ─── API 簽名（公開介面契約）─────────────────────────────────

// @GEMS-API: IDataEntryService
// @GEMS-STORY: Story-0.0
export interface IDataEntryService {
  createRecord(data: Omit<EmissionRecord, 'id' | 'co2e'>): Promise<EmissionRecord>;
  getRecords(orgId: string, period: string): Promise<EmissionRecord[]>;
  calcEmission(amount: number, factorId: string): number;
}

// @GEMS-API: IDashboardService
// @GEMS-STORY: Story-0.0
export interface IDashboardService {
  getScopeSummary(orgId: string, year: number): Promise<Record<EmissionScope, number>>;
  getTrendData(orgId: string, months: number): Promise<Array<{ month: string; totalCo2e: number }>>;
}

// ─── TDD 測試路徑（v7.0）────────────────────────────────────
// 此 iter-1 為 Foundation（骨架/型別定義層），無純計算邏輯
// → 所有 Story 不加 @GEMS-TDD，Phase 2 只跑 tsc --noEmit
