import { fetchAllTasks } from '../services/fetch-all-tasks.js';
import { toggleTaskStatus } from '../services/toggle-task-status.js';
import { removeTask } from '../services/remove-task.js';
import { saveNewTask } from '../services/save-new-task.js';
import { TaskListWidget } from '../components/task-list-widget.js';

export function TaskRoute(rootElement: HTMLElement): void {
    // [STEP] LOAD_TASKS
    const tasks = fetchAllTasks();

    // Re-calculate scores via engine if active before rendering
    const engine = (window as any).PriorityEngine;
    if (engine && engine.getScore) {
        tasks.forEach(t => {
            // Assuming a default importance of 5 if not provided yet. 
            // The task data could be extended if user provides it, but for now we just parse.
            t.priorityScore = engine.getScore(5, t.createdAt);
        });
    }

    // [STEP] BIND_ACTIONS
    if (!rootElement.hasAttribute('data-bound')) {
        rootElement.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;

            if (target.matches('.btn-toggle-task')) {
                const id = target.getAttribute('data-id');
                if (id) {
                    toggleTaskStatus(id);
                    TaskRoute(rootElement);
                }
            } else if (target.matches('.btn-remove-task')) {
                const id = target.getAttribute('data-id');
                if (id) {
                    removeTask(id);
                    TaskRoute(rootElement);
                }
            } else if (target.matches('#btn-add-task')) {
                e.preventDefault();
                const titleInput = document.getElementById('task-title-input') as HTMLInputElement;
                const importanceInput = document.getElementById('task-importance-input') as HTMLInputElement;

                if (titleInput && titleInput.value.trim() !== '') {
                    saveNewTask({
                        title: titleInput.value.trim(),
                        description: '',
                        importance: 5,
                        deadline: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days from now
                        estimatedMinutes: 30
                    });
                    // Note: Full form supports importance, but for UX simple saving is here
                    TaskRoute(rootElement);
                }
            }
        });
        rootElement.setAttribute('data-bound', 'true');
    }

    // [STEP] RENDER_MODULE
    rootElement.innerHTML = `
    <div id="task-route">
      <h2>Add a new quest</h2>
      <div class="task-form">
        <div class="input-group">
          <input type="text" id="task-title-input" placeholder="What needs to be done?" autocomplete="off" />
        </div>
        <button id="btn-add-task" class="btn-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Task
        </button>
      </div>

      <h2 style="margin-top: 40px;">Prioritized Queue</h2>
      ${TaskListWidget({ tasks })}
    </div>
  `;
}
