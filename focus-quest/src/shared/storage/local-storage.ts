// @GEMS-FUNCTION: localStorage
/**
 * GEMS: localStorage | P1 | ○○ | (args)→Result | Story-1.0 | 本地儲存封裝
 * GEMS-FLOW: INIT → CRUD_OPS → EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: local-storage.test.ts (內含 describe('localStorage'))
 */

// [STEP] INIT
export class LocalStorageWrapper {
    private prefix: string;

    constructor(prefix: string = 'focusquest_') {
        this.prefix = prefix;
    }

    // [STEP] CRUD_OPS
    setItem<T>(key: string, value: T): void {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(this.prefix + key, JSON.stringify(value));
        }
    }

    getItem<T>(key: string): T | null {
        if (typeof window !== 'undefined' && window.localStorage) {
            const item = window.localStorage.getItem(this.prefix + key);
            return item ? JSON.parse(item) : null;
        }
        return null;
    }

    removeItem(key: string): void {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(this.prefix + key);
        }
    }

    clear(): void {
        if (typeof window !== 'undefined' && window.localStorage) {
            const keysToRemove: string[] = [];
            for (let i = 0; i < window.localStorage.length; i++) {
                const k = window.localStorage.key(i);
                if (k && k.startsWith(this.prefix)) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach((k) => window.localStorage.removeItem(k));
        }
    }
}

// [STEP] EXPORT
export const storageWrapper = new LocalStorageWrapper();
