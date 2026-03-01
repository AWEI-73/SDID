import { validateTask, TaskStatus, type Task } from '../task-types.js';

describe('TaskTypes', () => {
    it('should validate a correct task', () => {
        const task: Partial<Task> = {
            title: 'Test Task',
            importance: 3,
            deadline: '2026-12-31',
            estimatedMinutes: 60
        };
        expect(validateTask(task)).toBe(true);
    });

    it('should fail if title is missing', () => {
        const task: Partial<Task> = {
            importance: 3,
            deadline: '2026-12-31',
            estimatedMinutes: 60
        };
        expect(validateTask(task)).toBe(false);
    });
});
