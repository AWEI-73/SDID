/**
 * GEMS: CoreTypes | P0 | ✓✓ | ()→Types | Story-1.0 | 核心型別定義
 * GEMS-FLOW: DEFINE→FREEZE→EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: core-types.test.ts
 */
// AC-1.0

// [STEP] DEFINE
export interface Organization {
  id: string;
  name: string;
  industry: string;
  reportYear: number;
}

export type EmissionScope = 'SCOPE1' | 'SCOPE2' | 'SCOPE3';

export interface EmissionRecord {
  id: string;
  orgId: string;
  scope: EmissionScope;
  category: string;
  amount: number;
  unit: string;
  factorId: string;
  co2e: number;
  period: string;
}

export interface EmissionFactor {
  id: string;
  name: string;
  category: string;
  value: number;
  unit: string;
  source: string;
  year: number;
}

// [STEP] FREEZE
export type CoreTypes = {
  readonly Organization: Organization;
  readonly EmissionRecord: EmissionRecord;
  readonly EmissionFactor: EmissionFactor;
};

// [STEP] EXPORT
