/**
 * GEMS: AppShell | P0 | ○○ | (args)→Result | Story-1.0 | 應用基礎路徑
 * GEMS-FLOW: INIT_LAYOUT → BIND_SHELL
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: app-shell.test.ts (內含 describe('AppShell'))
 */

// [STEP] INIT_LAYOUT
export const AppShell = ({ children }: { children: any }) => {
  return `
    <div id="app-shell">
      <header>
        <h1>Task-Priority-AI</h1>
      </header>
      <main id="main-content">
        ${children || ''}
      </main>
    </div>
  `;
};

// [STEP] BIND_SHELL
export const mountApp = (rootId: string, content: string) => {
  const root = document.getElementById(rootId);
  if (root) {
    root.innerHTML = AppShell({ children: content });
  }
};
