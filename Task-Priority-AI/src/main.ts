import './index.css';
import { mountApp } from './shared/pages/app-shell.js';
import { PriorityEngineRoute } from './modules/priority_engine/pages/priority-engine-route.js';
import { TaskRoute } from './modules/task_management/pages/task-route.js';

// Init engine globally
PriorityEngineRoute();

// Mount the App Shell wrapper
mountApp('root', '<div id="main-app-container"></div>');

// Mount the Tasks Route inner UI
const container = document.getElementById('main-app-container');
if (container) {
    // Pass root logic to Task Management
    TaskRoute(container);
}
