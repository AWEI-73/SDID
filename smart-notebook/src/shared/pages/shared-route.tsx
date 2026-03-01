import React from 'react';

/**
 * GEMS: SharedRoute | P0 | ○○ | (args)→Result | Story-1.0 | App骨架路由
 * GEMS-FLOW: INIT→MOUNTVIEW→RENDER
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: shared-route.test.ts (內含 describe('SharedRoute'))
 */

// [STEP] INIT
interface SharedRouteProps {
    children?: React.ReactNode;
}

// [STEP] MOUNTVIEW
export const SharedRoute: React.FC<SharedRouteProps> = ({ children }) => {
    // [STEP] RENDER
    return (
        <div className="app-container">
            <header>Smart Notebook</header>
            <main>{children}</main>
        </div>
    );
};
