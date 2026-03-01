// @GEMS-FUNCTION: removeTask
/**
 * GEMS: removeTask | P1 | ○○ | (id: string)→void | Story-2.0 | 刪除任務
 * GEMS-FLOW: FIND_BY_ID → FILTER_OUT → STORAGE_WRITE
 * GEMS-DEPS: [Task]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: remove-task.test.ts
 */
import { localStorageHelper } from '../../../shared/storage/local-storage-helper.js';
import type { Task } from '../../../shared/types/task-types.js';
import { fetchAllTasks } from './fetch-all-tasks.js';

export function removeTask(id: string): void {
    // [STEP] FIND_BY_ID
    const tasks = fetchAllTasks();
    // [STEP] FILTER_OUT
    const updatedTasks = tasks.filter((t: Task) => t.id !== id);
    // [STEP] STORAGE_WRITE
    localStorageHelper.set('tasks', updatedTasks);
}
