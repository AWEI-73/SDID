import { PriorityEngineRoute } from '../priority-engine-route.js';

describe('PriorityEngineRoute', () => {
    it('should initialize and bind engine to window', () => {
        // Basic unit test
        PriorityEngineRoute();
        expect((window as any).PriorityEngine).toBeDefined();
        expect(typeof (window as any).PriorityEngine.getScore).toBe('function');
    });
});
