import { ScoreBadge } from '../score-badge.js';

describe('ScoreBadge', () => {
    it('should render a red badge for score >= 80', () => {
        const badgeHtml = ScoreBadge(85);
        expect(badgeHtml).toContain('85/100');
        expect(badgeHtml).toContain('background-color: red');
    });

    it('should render an orange badge for score >= 50', () => {
        const badgeHtml = ScoreBadge(60);
        expect(badgeHtml).toContain('60/100');
        expect(badgeHtml).toContain('background-color: orange');
    });

    it('should render a green badge for score < 50', () => {
        const badgeHtml = ScoreBadge(30);
        expect(badgeHtml).toContain('30/100');
        expect(badgeHtml).toContain('background-color: green');
    });
});
