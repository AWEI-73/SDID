// @GEMS-FUNCTION: EmptyState
/**
 * GEMS: EmptyState | P3 | OO | ({icon,title,description,action?})=>JSX | Story-1.0 | Empty state component
 * GEMS-FLOW: LOAD_PROPS → RENDER → BIND_EVENTS
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: Unit
 * GEMS-TEST-FILE: empty-state.test.tsx (describe("EmptyState"))
 */

import React from "react";

interface EmptyStateProps {
  // [STEP] LOAD_PROPS
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// [STEP] RENDER
export function EmptyState({
  icon = "[empty]",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps): React.ReactElement {

  // [STEP] BIND_EVENTS
  const handleAction = onAction ? () => onAction() : undefined;

  return (
    <div
      role="status"
      aria-label={title}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        color: "#9CA3AF",
      }}
    >
      <span style={{ fontSize: "48px", marginBottom: "16px" }}>{icon}</span>
      <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 600, color: "#6B7280" }}>{title}</h3>
      {description && (
        <p style={{ margin: "0 0 24px", fontSize: "14px", maxWidth: "280px" }}>{description}</p>
      )}
      {actionLabel && handleAction && (
        <button
          onClick={handleAction}
          style={{
            padding: "10px 20px",
            background: "#6366F1",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;