// src/App.tsx
// 應用程式根元件 — import 並掛載 AppRouter

import React from 'react';
import AppRouter from './shared/pages/app-router';

export default function App(): React.JSX.Element {
    return <AppRouter />;
}
