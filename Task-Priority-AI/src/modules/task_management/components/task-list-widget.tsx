import { ScoreBadge } from '../../priority_engine/components/score-badge.js';
import type { Task } from '../../../shared/types/task-types.js';

export function TaskListWidget({ tasks }: { tasks: Task[] }): string {
  // [STEP] RECEIVE_DATA

  // [STEP] SORT_BY_SCORE
  const sortedTasks = [...tasks].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  // [STEP] RENDER_ITEMS
  if (sortedTasks.length === 0) {
    return `<div style="text-align: center; color: var(--text-secondary); padding: 40px; border-radius: 12px; background: rgba(0,0,0,0.2);">
      <p style="font-size: 16px;">Everything is clear. You have zero pending tasks.</p>
    </div>`;
  }

  return `
    <ul class="task-list">
      ${sortedTasks.map(task => `
        <li class="task-item" data-id="${task.id}">
          <div class="task-content">
            <span class="task-title ${task.status === 'DONE' ? 'completed' : ''}">${task.title}</span>
            <div class="task-meta">
              ${ScoreBadge(task.priorityScore || 0)}
              <span style="opacity: 0.7;">Created: ${new Date(task.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div>
            <button class="btn-toggle-task" data-id="${task.id}">
              ${task.status === 'DONE' ? 'Undo' : 'Complete'}
            </button>
            <button class="btn-remove-task" data-id="${task.id}">Delete</button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}
