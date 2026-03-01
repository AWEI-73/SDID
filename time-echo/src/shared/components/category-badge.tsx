// @GEMS-FUNCTION: CategoryBadge
/**
 * GEMS: CategoryBadge | P2 | ○○ | ({category: Category})→JSX | Story-1.0 | 分類標籤元件
 * GEMS-FLOW: LOAD_DATA → RENDER → BIND_EVENTS
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: category-badge.test.tsx (內含 describe('CategoryBadge'))
 */

import React from 'react';
import type { Category } from '../types/core-types';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../types/app-constants';

interface CategoryBadgeProps {
    // [STEP] LOAD_DATA
    category: Category;
    size?: 'sm' | 'md';
    onClick?: (category: Category) => void;
}

// [STEP] RENDER
export function CategoryBadge({ category, size = 'md', onClick }: CategoryBadgeProps): React.ReactElement {
    const color = CATEGORY_COLORS[category];
    const label = CATEGORY_LABELS[category];
    const paddingStyle = size === 'sm' ? '2px 8px' : '4px 12px';
    const fontSizeStyle = size === 'sm' ? '11px' : '13px';

    // [STEP] BIND_EVENTS
    const handleClick = onClick ? () => onClick(category) : undefined;

    return (
        <span
            role="button"
            tabIndex={onClick ? 0 : -1}
            onClick={handleClick}
            onKeyDown={handleClick ? (e) => e.key === 'Enter' && handleClick() : undefined}
            style={{
                display: 'inline-block',
                padding: paddingStyle,
                borderRadius: '20px',
                background: `${color}22`,
                color,
                border: `1px solid ${color}44`,
                fontSize: fontSizeStyle,
                fontWeight: 600,
                cursor: onClick ? 'pointer' : 'default',
                userSelect: 'none',
                transition: 'opacity 0.15s',
            }}
        >
            {label}
        </span>
    );
}

export default CategoryBadge;
