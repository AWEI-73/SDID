// @GEMS-FUNCTION: storage
/**
 * GEMS: storage | P1 | ○○ | (key, value?)→any | Story-1.0 | localStorage 封裝
 * GEMS-FLOW: INIT → CRUD_OPS → EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: storage.test.ts (內含 describe('storage'))
 */

// [STEP] INIT
const isAvailable = (): boolean => {
    try {
        const key = '__storage_test__';
        localStorage.setItem(key, key);
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
};

// [STEP] CRUD_OPS
export function storageGet<T>(key: string): T | null {
    if (!isAvailable()) return null;
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export function storageSet<T>(key: string, value: T): boolean {
    if (!isAvailable()) return false;
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function storageRemove(key: string): void {
    if (!isAvailable()) return;
    localStorage.removeItem(key);
}

export function storageClear(): void {
    if (!isAvailable()) return;
    localStorage.clear();
}

// [STEP] EXPORT
export const storage = {
    get: storageGet,
    set: storageSet,
    remove: storageRemove,
    clear: storageClear,
};

export default storage;
