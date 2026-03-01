// @GEMS-FUNCTION: toggleTaskStatus
/**
 * GEMS: toggleTaskStatus | P1 | ○○ | (id: string)→Task | Story-2.0 | 切換完成狀態
 * GEMS-FLOW: FIND_BY_ID → UPDATE_STATUS → STORAGE_WRITE
 * GEMS-DEPS: [Task]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: toggle-task-status.test.ts
 */
import { localStorageHelper } from '../../../shared/storage/local-storage-helper.js';
import { type Task, TaskStatus } from '../../../shared/types/task-types.js';
import { fetchAllTasks } from './fetch-all-tasks.js';

export function toggleTaskStatus(id: string): Task {
    // [STEP] FIND_BY_ID
    const tasks = fetchAllTasks();
    const index = tasks.findIndex((t: Task) => t.id === id);
    if (index === -1) throw new Error('Task not found');

    // [STEP] UPDATE_STATUS
    const task = tasks[index];
    task.status = task.status === TaskStatus.TODO ? TaskStatus.DONE : TaskStatus.TODO;

    // [STEP] STORAGE_WRITE
    localStorageHelper.set('tasks', tasks);
    return task;
}
