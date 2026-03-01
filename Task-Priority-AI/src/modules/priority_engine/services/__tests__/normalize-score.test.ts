import { normalizeScore } from '../normalize-score.js';

describe('normalizeScore', () => {
    it('should scale and clamp the score correctly', () => {
        // Score > 10
        expect(normalizeScore(15)).toBe(100);
        // Score < 0
        expect(normalizeScore(-5)).toBe(0);
        // Score in range (5.5 * 10 = 55)
        expect(normalizeScore(5.5)).toBe(55);
    });
});
