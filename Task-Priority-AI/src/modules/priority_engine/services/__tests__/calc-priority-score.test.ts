import { calcPriorityScore } from '../calc-priority-score.js';

describe('calcPriorityScore', () => {
    it('should return a score based on importance and deadline', () => {
        const deadline = new Date(Date.now() + 86400000).toISOString();
        const score = calcPriorityScore(5, deadline);
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThan(0);
    });
});
