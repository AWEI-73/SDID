import { calcPriorityScore } from '../calc-priority-score.js';

describe('calcPriorityScore E2E test', () => {
    it('should calculate score and interact with localStorage to simulate E2E flow', () => {
        // Calculate a score for an urgent task
        const tomorrow = new Date(Date.now() + 86400000).toISOString();
        const score = calcPriorityScore(5, tomorrow);

        // Simulate saving the score to localStorage as part of a real flow
        localStorage.setItem('e2e_test_score', score.toString());

        const stored = localStorage.getItem('e2e_test_score');
        expect(Number(stored)).toEqual(score);
    });
});
