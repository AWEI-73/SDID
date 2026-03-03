// @GEMS-FUNCTION: StorageService
/**
 * GEMS: StorageService | P1 | ⬜ | (args)→Result | Story-1.0 | 儲存層服務
 * GEMS-FLOW: INIT→GET→SET→EXPORT
 * GEMS-DEPS: [Shared.CoreTypes]
 * GEMS-DEPS-RISK: MEDIUM
 */
// @GEMS [P1] Shared.StorageService | FLOW: INIT→GET→SET→EXPORT | L9-16
export class StorageService {
    get<T>(key: string): T | null {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
    }
    set<T>(key: string, value: T): void {
        localStorage.setItem(key, JSON.stringify(value));
    }
}
