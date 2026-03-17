import React, { useState } from 'react';
import DashboardPage from '../../modules/Dashboard/pages/dashboard-page';
import ImportPage from '../../modules/Import/pages/import-page';
import ClassManagementPage from '../../modules/ClassManagement/pages/class-management-page';
import NodeManagementPage from '../../modules/NodeManagement/pages/node-management-page';

/**
 * GEMS: AppRouter | P1 | ✓✓ | ()→JSX.Element | Story-1.0 | React 前端路由入口
 * GEMS-FLOW: ENTRY→ROUTER→PAGES
 * GEMS-DEPS: [TrainingClassSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] ENTRY — 應用程式入口，定義頁面路由
// [STEP] ROUTER — 根據 activePage 狀態切換頁面
// [STEP] PAGES — 渲染對應頁面元件

type Page = 'dashboard' | 'classes' | 'import' | 'nodes';

export default function AppRouter() {
  // [STEP] ENTRY
  const [activePage, setActivePage] = useState<Page>('dashboard');

  // [STEP] ROUTER
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />;
      case 'classes':   return <ClassManagementPage />;
      case 'import':    return <ImportPage />;
      case 'nodes':     return <NodeManagementPage />;
    }
  };

  // [STEP] PAGES
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {renderPage()}
      </main>
    </div>
  );
}

function Sidebar({ activePage, onNavigate }: { activePage: Page; onNavigate: (p: Page) => void }) {
  const items: { key: Page; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'classes',   label: '班別管理',   icon: '📚' },
    { key: 'nodes',     label: '節點管控',   icon: '�' },
    { key: 'import',    label: '資料匯入',   icon: '📥' },
  ];
  return (
    <nav style={{ width: 200, background: '#fff', borderRight: '1px solid #dee2e6', padding: '16px 0', flexShrink: 0 }}>
      <div style={{ padding: '0 16px 16px', fontSize: 15, fontWeight: 600, color: '#0066cc', borderBottom: '1px solid #dee2e6', marginBottom: 8 }}>
        📋 訓練計畫管理
      </div>
      {items.map(item => (
        <div
          key={item.key}
          onClick={() => onNavigate(item.key)}
          style={{
            padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            background: activePage === item.key ? '#e8f0fe' : 'transparent',
            color: activePage === item.key ? '#0066cc' : '#495057',
            fontWeight: activePage === item.key ? 500 : 400,
          }}
        >
          {item.icon} {item.label}
        </div>
      ))}
    </nav>
  );
}
