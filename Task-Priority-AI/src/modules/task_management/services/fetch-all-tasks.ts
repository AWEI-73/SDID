// @GEMS-FUNCTION: fetchAllTasks
/**
 * GEMS: fetchAllTasks | P0 | ○○ | ()→Task[] | Story-2.0 | 取得所有任務
 * GEMS-FLOW: STORAGE_READ → INJECT_SCORE → SORT → RETURN
 * GEMS-DEPS: [Task]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: fetch-all-tasks.test.ts
 */
import { localStorageHelper } from '../../../shared/storage/local-storage-helper.js';
import type { Task } from '../../../shared/types/task-types.js';

export function fetchAllTasks(): Task[] {
    // [STEP] STORAGE_READ
    const tasks = localStorageHelper.get<Task[]>('tasks') || [];
    // [STEP] INJECT_SCORE
    const tasksWithScore = tasks.map(t => ({ ...t, priorityScore: t.priorityScore || 0 }));
    // [STEP] SORT
    tasksWithScore.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    // [STEP] RETURN
    return tasksWithScore;
}
