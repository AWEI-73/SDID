import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './shared/pages/app-shell';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);
root.render(<AppShell />);
