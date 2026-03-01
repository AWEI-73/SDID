import { PriorityEngineRoute } from '../priority-engine-route.js';

describe('PriorityEngineRoute Integration', () => {
    it('should calculate and return normalized score through the exposed API without mock', () => {
        PriorityEngineRoute();
        const score = (window as any).PriorityEngine.getScore(5, new Date(Date.now() + 86400000).toISOString());
        expect(score).toBeGreaterThan(0);
    });
});
