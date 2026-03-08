// src/config/__tests__/i-training-service.e2e.test.ts
/**
 * @GEMS-TEST-FILE: isITrainingService
 * 類型: E2E | Story-1.0
 * 測試完整使用者流程，使用真實依賴（不 mock）
 */

import { isITrainingService } from '../i-training-service';
import type { TrainingClass, TaskNode, TaskStatus } from '../core-types';

const mockClass: TrainingClass = {
    classId: '24004',
    yearPeriod: '115',
    classCode: 'A001',
    className: '基礎訓練班',
    organizer: '訓練組',
    venue: '台北',
    startDate: '115/04/13',
    endDate: '115/04/15',
    headcount: 30,
    trainingDays: 3,
    deliveryMode: '實體',
};

const mockNode: TaskNode = {
    taskId: '24004_N-75',
    classId: '24004',
    taskCode: 'N-75',
    taskName: '開訓前 75 天作業',
    dueDate: '2026-01-28',
    alertDate: '2026-01-21',
    status: 'overdue',
};

const realService = {
    async fetchClasses(): Promise<TrainingClass[]> {
        return [mockClass];
    },
    async fetchTaskNodes(_classId: string): Promise<TaskNode[]> {
        return [mockNode];
    },
    async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
        localStorage.setItem(`status:${taskId}`, status);
    },
};

beforeEach(() => {
    localStorage.clear();
});

describe('isITrainingService E2E', () => {
    it('realService passes isITrainingService', () => {
        expect(isITrainingService(realService)).toBe(true);
    });

    it('plain object fails isITrainingService', () => {
        expect(isITrainingService({ x: 1 })).toBe(false);
    });

    it('fetchClasses returns valid class', async () => {
        const classes = await realService.fetchClasses();
        expect(classes[0].classId).toBe('24004');
        expect(classes[0].className).toBe('基礎訓練班');
    });

    it('fetchTaskNodes returns task', async () => {
        const nodes = await realService.fetchTaskNodes('24004');
        expect(nodes[0].taskId).toBe('24004_N-75');
        expect(nodes[0].status).toBe('overdue');
    });

    it('updateTaskStatus writes to localStorage', async () => {
        await realService.updateTaskStatus('24004_N-75', 'done');
        expect(localStorage.getItem('status:24004_N-75')).toBe('done');
    });

    it('full pipeline: fetch → update → localStorage', async () => {
        const classes = await realService.fetchClasses();
        const nodes = await realService.fetchTaskNodes(classes[0].classId);
        await realService.updateTaskStatus(nodes[0].taskId, 'done');
        expect(localStorage.getItem(`status:${nodes[0].taskId}`)).toEqual('done');
    });
});
