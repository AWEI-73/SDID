// src/config/__tests__/core-types.test.ts
// Unit tests for CoreTypes

import type { TrainingClass, TaskNode, NodeParamConfig, TaskStatus } from '../core-types';
import { _taskStatusCheck } from '../core-types';

describe('CoreTypes — Unit', () => {
    describe('TaskStatus', () => {
        it('should include all valid status values', () => {
            const validStatuses: TaskStatus[] = ['pending', 'done', 'overdue'];
            validStatuses.forEach(s => {
                expect(['pending', 'done', 'overdue']).toContain(s);
            });
        });

        it('_taskStatusCheck should have all three status keys', () => {
            expect(Object.keys(_taskStatusCheck)).toEqual(
                expect.arrayContaining(['pending', 'done', 'overdue'])
            );
        });
    });

    describe('TrainingClass shape', () => {
        it('should accept a valid TrainingClass object', () => {
            const cls: TrainingClass = {
                classId: '24004',
                yearPeriod: '115',
                classCode: 'A001',
                className: '測試課程',
                organizer: '訓練組',
                venue: '台北',
                startDate: '115/04/13',
                endDate: '115/04/15',
                headcount: 30,
                trainingDays: 3,
                deliveryMode: '實體',
            };
            expect(cls.classId).toBe('24004');
            expect(cls.startDate).toBe('115/04/13');
        });

        it('should allow optional fields to be undefined', () => {
            const cls: TrainingClass = {
                classId: '77006',
                yearPeriod: '115',
                classCode: 'B002',
                className: '線上課程',
                organizer: '人事處',
                venue: '視訊',
                startDate: '115/05/01',
                endDate: '115/05/03',
                headcount: 20,
                trainingDays: 3,
                deliveryMode: '線上',
            };
            expect(cls.useComputerRoom).toBeUndefined();
            expect(cls.canDelegate).toBeUndefined();
        });
    });

    describe('TaskNode shape', () => {
        it('should accept a valid TaskNode object', () => {
            const node: TaskNode = {
                taskId: '24004_N-75',
                classId: '24004',
                taskCode: 'N-75',
                taskName: '開訓前 75 天作業',
                dueDate: '115/01/28',
                alertDate: '115/01/21',
                status: 'pending',
            };
            expect(node.taskId).toBe('24004_N-75');
            expect(node.status).toBe('pending');
        });
    });

    describe('NodeParamConfig shape', () => {
        it('should accept a valid NodeParamConfig object', () => {
            const param: NodeParamConfig = {
                taskCode: 'N-75',
                taskName: '開訓前 75 天作業',
                offsetDays: 75,
                earlyAlertDays: 7,
            };
            expect(param.offsetDays).toBe(75);
            expect(param.earlyAlertDays).toBe(7);
        });
    });
});
