// @GEMS-FUNCTION: PriorityEngineRoute
/**
 * GEMS: PriorityEngineRoute | P0 | ○○ | ()→void | Story-2.1 | 引擎模組入口
 * GEMS-FLOW: INIT_ENGINE → EXPORT_API → BIND_ENGINE
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: priority-engine-route.test.ts
 */
import { calcPriorityScore } from '../services/calc-priority-score.js';
import { normalizeScore } from '../services/normalize-score.js';

export function PriorityEngineRoute(): void {
    // [STEP] INIT_ENGINE
    const engineContext = {
        version: '1.0.0',
        isActive: true
    };

    // [STEP] EXPORT_API
    const publicApi = {
        getScore: (importance: number, deadline: string) => {
            if (!engineContext.isActive) return 0;
            const raw = calcPriorityScore(importance, deadline);
            return normalizeScore(raw);
        }
    };

    // [STEP] BIND_ENGINE
    // Expose to window for the task_management to access indirectly or use as a global service
    if (typeof window !== 'undefined') {
        (window as any).PriorityEngine = publicApi;
    }
}
