// @GEMS-FUNCTION: MoodIcon
/**
 * GEMS: MoodIcon | P2 | ○○ | ({mood: Mood})→JSX | Story-1.0 | 心情圖示元件
 * GEMS-FLOW: LOAD_DATA → RENDER → BIND_EVENTS
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: mood-icon.test.tsx (內含 describe('MoodIcon'))
 */

import React from 'react';
import type { Mood } from '../types/core-types';
import { MOOD_EMOJI, MOOD_LABELS } from '../types/app-constants';

interface MoodIconProps {
    // [STEP] LOAD_DATA
    mood: Mood;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    onClick?: (mood: Mood) => void;
}

const FONT_SIZES: Record<NonNullable<MoodIconProps['size']>, string> = {
    sm: '16px',
    md: '22px',
    lg: '32px',
};

// [STEP] RENDER
export function MoodIcon({ mood, showLabel = false, size = 'md', onClick }: MoodIconProps): React.ReactElement {
    const emoji = MOOD_EMOJI[mood];
    const label = MOOD_LABELS[mood];
    const fontSize = FONT_SIZES[size];

    // [STEP] BIND_EVENTS
    const handleClick = onClick ? () => onClick(mood) : undefined;

    return (
        <span
            title={label}
            role={onClick ? 'button' : 'img'}
            aria-label={label}
            tabIndex={onClick ? 0 : -1}
            onClick={handleClick}
            onKeyDown={handleClick ? (e) => e.key === 'Enter' && handleClick() : undefined}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize,
                cursor: onClick ? 'pointer' : 'default',
                userSelect: 'none',
            }}
        >
            {emoji}
            {showLabel && (
                <span style={{ fontSize: '13px', color: '#6B7280' }}>{label}</span>
            )}
        </span>
    );
}

export default MoodIcon;
