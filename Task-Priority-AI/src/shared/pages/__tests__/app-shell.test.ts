import { AppShell } from '../app-shell.js';

describe('AppShell', () => {
    it('should render the shell with children', () => {
        const content = '<div>Test Content</div>';
        const result = AppShell({ children: content });
        expect(result).toContain('Task-Priority-AI');
        expect(result).toContain(content);
    });
});
