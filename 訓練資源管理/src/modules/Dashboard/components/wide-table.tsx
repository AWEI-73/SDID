// src/modules/Dashboard/components/wide-table.tsx (由 draft-to-plan 自動生成)

/**
 * GEMS: WideTable | P1 | ○○ | (args)→Result | Story-2.0 | 寬表元件
 * GEMS-FLOW: FETCH_DATA→RENDER_HEADER→RENDER_ROWS→BIND_STATUS
 * GEMS-DEPS: [Internal.useTrainingData, StatusBadge]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: wide-table.test.tsx
 */
// AC-1.4
import StatusBadge from './status-badge';

export default function WideTable() {
  // [STEP] FETCH_DATA
  const data = 1;
  // [STEP] RENDER_HEADER
  const header = 2;
  // [STEP] RENDER_ROWS
  const rows = <StatusBadge />;
  // [STEP] BIND_STATUS
  return <div>{data + header}{rows}</div>;
}
