// src/modules/Dashboard/pages/dashboard-page.tsx (由 draft-to-plan 自動生成)

/**
 * GEMS: DashboardPage | P1 | ○○ | (args)→Result | Story-2.0 | 監控主頁路由
 * GEMS-FLOW: LOAD_DATA→RENDER_FILTER→RENDER_TABLE→BIND_EVENTS
 * GEMS-DEPS: [Internal.WideTable, Internal.useTrainingData]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: dashboard-page.test.ts
 */
// AC-1.5
import WideTable from '../components/wide-table';

export default function DashboardPage() {
  // [STEP] LOAD_DATA
  const data = 1;
  // [STEP] RENDER_FILTER
  const filter = 2;
  // [STEP] RENDER_TABLE
  const table = <WideTable />;
  // [STEP] BIND_EVENTS
  return <div>{data + filter}{table}</div>;
}
