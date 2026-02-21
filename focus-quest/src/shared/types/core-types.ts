// @GEMS-FUNCTION: CoreTypes
/**
 * GEMS: CoreTypes | P0 | ○○ | (args)→Result | Story-1.0 | 核心型別定義
 * GEMS-FLOW: DEFINE → FREEZE → EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: core-types.test.ts (內含 describe('CoreTypes'))
 */

// [STEP] DEFINE
export interface UserProfile {
    id: string;
    name: string;
    level: number;
    xp: number;
}

export interface FocusSession {
    id: string;
    duration: number;
    completedAt: Date;
    xpEarned: number;
}

// [STEP] FREEZE
export const freezeProfile = (profile: UserProfile): Readonly<UserProfile> => Object.freeze({ ...profile });

// [STEP] EXPORT
export const DEFAULT_LEVEL = 1;
export const DEFAULT_XP = 0;
