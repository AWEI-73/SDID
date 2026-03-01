// @GEMS-FUNCTION: saveNewTask
/**
 * GEMS: saveNewTask | P0 | ○○ | (taskData: Omit<Task, 'id' | 'createdAt' | 'status' | 'priorityScore'>)→Task | Story-2.0 | 儲存新任務
 * GEMS-FLOW: VALIDATE → GENERATE_ID → CALC_SCORE → STORAGE_WRITE
 * GEMS-DEPS: [Task]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: save-new-task.test.ts
 */
import { localStorageHelper } from '../../../shared/storage/local-storage-helper.js';
import { type Task, validateTask, TaskStatus } from '../../../shared/types/task-types.js';
import { fetchAllTasks } from './fetch-all-tasks.js';

export function saveNewTask(taskData: Omit<Task, 'id' | 'createdAt' | 'status' | 'priorityScore'>): Task {
    // [STEP] VALIDATE
    if (!taskData.title || taskData.title.trim() === '') {
        throw new Error('Title is required');
    }

    // [STEP] GENERATE_ID
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 9);

    // [STEP] CALC_SCORE
    const priorityScore = 0; // priority_engine 將提供實際分數，目前提供 0

    // [STEP] STORAGE_WRITE
    const newTask: Task = {
        ...taskData,
        id,
        priorityScore,
        createdAt: new Date().toISOString(),
        status: TaskStatus.TODO
    };

    const isValid = validateTask(newTask);
    if (!isValid) throw new Error('Task validation failed');

    const tasks = fetchAllTasks();
    tasks.push(newTask);
    localStorageHelper.set('tasks', tasks);

    return newTask;
}
