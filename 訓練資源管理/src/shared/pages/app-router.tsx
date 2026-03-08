// src/shared/pages/app-router.tsx (由 draft-to-plan 自動生成)

/**
 * @GEMS-FUNCTION: AppRouter
 * GEMS: AppRouter | P1 | ○○ | (args)→Result | Story-1.0 | 前端主入口殼
 * GEMS-FLOW: CHECK_ROUTE→LOAD_LAYOUT→RENDER_ROUTES
 * GEMS-DEPS: [Internal.CoreTypes]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: app-router.test.ts
 */
// AC-0.2

import React from 'react';
import DashboardPage from '../../modules/Dashboard/pages/dashboard-page';

/** 支援的路由設定 */
const ROUTES: Record<string, { title: string; element: React.ReactNode }> = {
  '/': {
    title: '監控儀表板',
    element: (
      <DashboardPage />
    ),
  },
  '/settings': {
    title: '節點參數設定',
    element: (
      <div id="settings-page">
        <h1>節點參數設定</h1>
      </div>
    ),
  },
};

export default function AppRouter(): React.JSX.Element {
  // [STEP] CHECK_ROUTE
  const path = window.location.pathname;
  const currentRoute = ROUTES[path];

  // [STEP] LOAD_LAYOUT
  const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="app-layout">
      <header className="app-header">
        <nav>
          {Object.entries(ROUTES).map(([routePath, r]) => (
            <a key={routePath} href={routePath}>{r.title}</a>
          ))}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );

  // [STEP] RENDER_ROUTES
  return (
    <Layout>
      {currentRoute ? currentRoute.element : <p>頁面不存在</p>}
    </Layout>
  );
}
