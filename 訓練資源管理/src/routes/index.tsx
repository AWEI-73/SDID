// src/routes/index.tsx
// 路由配置檔案 — 集中管理所有 App 路由定義

import React from 'react';

/** 路由定義型別 */
export interface RouteConfig {
    path: string;
    title: string;
    element: React.ReactNode;
}

/** 儀表板頁面元件（待實作正式元件） */
const DashboardPage = () => (
    <div id="dashboard-page">
        <h1>訓練流程監控儀表板</h1>
        <p>載入中…</p>
    </div>
);

/** 節點參數設定頁面元件（待實作正式元件） */
const SettingsPage = () => (
    <div id="settings-page">
        <h1>節點參數設定</h1>
        <p>載入中…</p>
    </div>
);

/** 主路由配置表 */
export const routes: RouteConfig[] = [
    {
        path: '/',
        title: '監控儀表板',
        element: <DashboardPage />,
    },
    {
        path: '/settings',
        title: '節點參數設定',
        element: <SettingsPage />,
    },
];

/** 根據路徑取得路由配置 */
export function getRoute(path: string): RouteConfig | undefined {
    return routes.find(r => r.path === path);
}

export default routes;
