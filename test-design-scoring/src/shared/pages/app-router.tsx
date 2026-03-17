/**
 * GEMS: AppRouter | P1 | ✓✓ | N/A→JSX | Story-0.0 | 前端主入口殼
 * GEMS-FLOW: CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES
 * GEMS-DEPS: [CoreTypes]
 * GEMS-DEPS-RISK: MEDIUM
 */
// AC-0.2
// [STEP] CHECK_AUTH
// [STEP] LOAD_LAYOUT
// [STEP] RENDER_ROUTES

import React from 'react';

// Placeholder route components — replaced in iter-2/iter-3
const LedgerPage = React.lazy(() => import('../../modules/Ledger/components/ledger-page'));
const SummaryPage = React.lazy(() => import('../../modules/Summary/components/summary-page'));

export function AppRouter(): React.ReactElement {
  // [STEP] CHECK_AUTH — no auth in this app (single user)
  // [STEP] LOAD_LAYOUT
  // [STEP] RENDER_ROUTES
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <nav>
        <a href="/ledger">記帳</a>
        <a href="/summary">統計</a>
      </nav>
      <main>
        {/* Routes wired in iter-2/iter-3 */}
      </main>
    </React.Suspense>
  );
}
