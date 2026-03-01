// @GEMS-FUNCTION: AppShell
/**
 * GEMS: AppShell | P0 | OO | ()=>JSX | Story-1.0 | App shell router
 * GEMS-FLOW: INIT_ROUTER → LOAD_LAYOUT → RENDER_OUTLET
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: Unit | Integration | E2E
 * GEMS-TEST-FILE: app-shell.test.ts (describe("AppShell"))
 */

import React, { useState } from "react";
import { APP_NAME } from "../types/app-constants";

type Route = "tracker" | "review";

interface AppShellProps {
  trackerContent?: React.ReactNode;
  reviewContent?: React.ReactNode;
}

// [STEP] INIT_ROUTER
const NAV_ITEMS: { route: Route; icon: string; label: string }[] = [
  { route: "tracker", icon: "T", label: "Record" },
  { route: "review", icon: "R", label: "Review" },
];

// [STEP] LOAD_LAYOUT
export function AppShell({ trackerContent, reviewContent }: AppShellProps): React.ReactElement {
  const [currentRoute, setCurrentRoute] = useState<Route>("tracker");

  // [STEP] RENDER_OUTLET
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0F0F1A", color: "#E2E8F0" }}>
      <header style={{
        padding: "16px 24px",
        background: "rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>{APP_NAME}</h1>
      </header>

      <main style={{ flex: 1, overflow: "auto", padding: "24px 16px" }}>
        {currentRoute === "tracker" && (trackerContent ?? <div>Tracker placeholder</div>)}
        {currentRoute === "review" && (reviewContent ?? <div>Review placeholder</div>)}
      </main>

      <nav style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        {NAV_ITEMS.map(({ route, icon, label }) => (
          <button
            key={route}
            data-testid={"nav-" + route}
            onClick={() => setCurrentRoute(route)}
            style={{
              flex: 1,
              padding: "12px",
              background: "transparent",
              border: "none",
              color: currentRoute === route ? "#6366F1" : "#6B7280",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>{icon}</span>
            <span style={{ fontSize: "11px" }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default AppShell;