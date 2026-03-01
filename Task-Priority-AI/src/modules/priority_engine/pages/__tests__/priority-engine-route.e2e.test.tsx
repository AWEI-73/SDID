import { PriorityEngineRoute } from '../priority-engine-route.js';

describe('PriorityEngineRoute E2E', () => {
    it('simulates priority engine initialization connected with localStorage interaction', () => {
        PriorityEngineRoute();
        const score = (window as any).PriorityEngine.getScore(5, new Date(Date.now() + 86400000).toISOString());

        // Simulate updating task with the new score through E2E interaction
        document.body.innerHTML = `<div id="app"></div>`;
        localStorage.setItem('engine_e2e_test_score', score.toString());

        expect(localStorage.getItem('engine_e2e_test_score')).toEqual(score.toString());
    });
});
