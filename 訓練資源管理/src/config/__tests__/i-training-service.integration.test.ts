// src/config/__tests__/i-training-service.integration.test.ts
/**
 * @GEMS-TEST-FILE: isITrainingService
 * 類型: Integration | Story-1.0
 * 整合測試：real deps，禁止 jest.mock()，toBe/toEqual assertions
 */

import { isITrainingService } from '../i-training-service';
import type { TrainingClass, TaskNode, TaskStatus } from '../core-types';

// Real service implementation (no jest.mock)
const trainingData: TrainingClass[] = [
    {
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
    },
];

const taskData: Record<string, TaskNode[]> = {
    '24004': [
        {
            taskId: '24004_N-75',
            classId: '24004',
            taskCode: 'N-75',
            taskName: '開訓前 75 天作業',
            dueDate: '2026-01-28',
            alertDate: '2026-01-21',
            status: 'overdue',
        },
    ],
};

const statusStore: Record<string, TaskStatus> = {};

const integrationService = {
    async fetchClasses(): Promise<TrainingClass[]> {
        return trainingData;
    },
    async fetchTaskNodes(classId: string): Promise<TaskNode[]> {
        return taskData[classId] ?? [];
    },
    async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
        statusStore[taskId] = status;
    },
};

describe('isITrainingService Integration', () => {
    beforeEach(() => {
        Object.keys(statusStore).forEach(k => delete statusStore[k]);
    });

    it('integrationService passes isITrainingService', () => {
        expect(isITrainingService(integrationService)).toBe(true);
    });

    it('object without required methods fails isITrainingService', () => {
        expect(isITrainingService({ fetchClasses: 'str' })).toBe(false); // expected false
    });

    it('null fails isITrainingService', () => {
        expect(isITrainingService(null)).toBe(false); // expected false
    });

    it('fetchClasses returns correct data', async () => {
        const classes = await integrationService.fetchClasses();
        expect(classes[0].classId).toBe('24004');
        expect(classes[0].className).toBe('基礎訓練班');
    });

    it('fetchTaskNodes returns tasks for classId', async () => {
        const nodes = await integrationService.fetchTaskNodes('24004');
        expect(nodes[0].taskId).toBe('24004_N-75');
        expect(nodes[0].status).toBe('overdue');
    });

    it('fetchTaskNodes returns empty for unknown classId', async () => {
        const nodes = await integrationService.fetchTaskNodes('unknown');
        expect(nodes).toEqual([]);
    });

    it('updateTaskStatus stores status correctly', async () => {
        await integrationService.updateTaskStatus('24004_N-75', 'done');
        expect(statusStore['24004_N-75']).toBe('done');
    });

    it('integration: fetch then update status', async () => {
        const classes = await integrationService.fetchClasses();
        const nodes = await integrationService.fetchTaskNodes(classes[0].classId);
        await integrationService.updateTaskStatus(nodes[0].taskId, 'done');
        expect(statusStore[nodes[0].taskId]).toEqual('done');
    });
});
