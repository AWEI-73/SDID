/**
 * GEMS: TaskTypes | P0 | ○○ | (args)→Result | Story-1.0 | 任務實體定義
 * GEMS-FLOW: DEFINE → VALIDATE → FREEZE → EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: task-types.test.ts (內含 describe('TaskTypes'))
 */

// [STEP] DEFINE
export const TaskTypes = {};

export enum TaskStatus {
    TODO = 'TODO',
    DONE = 'DONE'
}

export interface Task {
    id: string;
    title: string;
    description: string | null;
    importance: number;
    deadline: string;
    estimatedMinutes: number;
    priorityScore: number;
    status: TaskStatus;
    createdAt: string;
}

// [STEP] VALIDATE
export const validateTask = (task: Partial<Task>): boolean => {
    return !!(task.title && task.importance && task.deadline && task.estimatedMinutes);
};

// [STEP] FREEZE
export const TASK_DEFAULTS = Object.freeze({
    importance: 1,
    status: TaskStatus.TODO,
    estimatedMinutes: 30
});

// [STEP] EXPORT
export default TaskTypes;
