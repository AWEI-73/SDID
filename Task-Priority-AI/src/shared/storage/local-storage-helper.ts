// @GEMS-FUNCTION: localStorageHelper
/**
 * GEMS: localStorageHelper | P1 | ○○ | (args)→Result | Story-1.0 | 本地存儲封裝
 * GEMS-FLOW: READ → PARSE → WRITE
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: local-storage-helper.test.ts (內含 describe('localStorageHelper'))
 */
export type LocalStorageHelper = typeof localStorageHelper;

export const localStorageHelper = {
    // [STEP] READ
    get: <T>(key: string): T | null => {
        if (typeof window === 'undefined') return null;
        const data = localStorage.getItem(key);
        if (!data) return null;

        // [STEP] PARSE
        try {
            return JSON.parse(data) as T;
        } catch (e) {
            return null;
        }
    },
    // [STEP] WRITE
    set: <T>(key: string, value: T): void => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }
};
