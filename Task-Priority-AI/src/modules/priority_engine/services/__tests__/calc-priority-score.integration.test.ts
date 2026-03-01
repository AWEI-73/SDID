import { calcPriorityScore } from '../calc-priority-score.js';

describe('calcPriorityScore Integration test', () => {
    it('should return a higher score when deadline is closer without any mocks', () => {
        const farDate = new Date(Date.now() + 10 * 86400000).toISOString();
        const closeDate = new Date(Date.now() + 1 * 86400000).toISOString();

        // Higher priority score is expected for the closer deadline
        const scoreFar = calcPriorityScore(5, farDate);
        const scoreClose = calcPriorityScore(5, closeDate);

        expect(scoreFar).toBeLessThan(scoreClose);
    });
});
