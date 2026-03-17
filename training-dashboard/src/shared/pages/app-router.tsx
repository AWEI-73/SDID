import React, { useState } from 'react';
import DashboardPage from '../../modules/Dashboard/pages/dashboard-page';
import ImportPage from '../../modules/Import/pages/import-page';
import ClassManagementPage from '../../modules/ClassManagement/pages/class-management-page';

/**
 * GEMS: AppRouter | P1 | ✓○ | ()→JSX.Element | Story-1.0 | React 前端路由入口
 * GEMS-FLOW: ENTRY→ROUTER→PAGES
 * GEMS-DEPS: [TrainingClassSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] ENTRY — 應用程式入口，定義頁面路由
// [STEP] ROUTER — 根據 activePage 狀態切換頁面
// [STEP] PAGES — 渲染對應頁面元件（lazy import 待 Story-1.1+ 實作）

type Page = 'dashboard' | 'classes' | 'import' | 'rooms';

export default function AppRouter() {
  // [STEP] ENTRY
  const [activePage, setActivePage] = useState<Page>('dashboard');

  // [STEP] ROUTER
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />;
      case 'classes':   return <ClassManagementPage />;
      case 'import':    return <ImportPage />;
      case 'rooms':     return <PlaceholderPage title="教室排程" desc="教室時間軸視覺化（iter-2）" />;
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
    { key: 'import',    label: '資料匯入',   icon: '📥' },
    { key: 'rooms',     label: '教室排程',   icon: '🏫' },
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

function PlaceholderPage({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h1>
      <p style={{ color: '#6c757d' }}>{desc}</p>
    </div>
  );
}
