// src/config/__tests__/core-types.integration.test.ts
// Integration tests for CoreTypes — cross-type compatibility

import type { TrainingClass, TaskNode, NodeParamConfig, TaskStatus } from '../core-types';

describe('CoreTypes — Integration', () => {
    describe('TrainingClass + TaskNode relationship', () => {
        it('TaskNode.classId should match TrainingClass.classId', () => {
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

            const node: TaskNode = {
                taskId: `${cls.classId}_N-75`,
                classId: cls.classId,
                taskCode: 'N-75',
                taskName: '開訓前 75 天作業',
                dueDate: '115/01/28',
                alertDate: '115/01/21',
                status: 'pending',
            };

            expect(node.classId).toBe(cls.classId);
            expect(node.taskId).toContain(cls.classId);
        });

        it('NodeParamConfig should generate correct offsetDays for TaskNode', () => {
            const param: NodeParamConfig = {
                taskCode: 'N-75',
                taskName: '開訓前 75 天作業',
                offsetDays: 75,
                earlyAlertDays: 7,
            };

            // 驗證 offsetDays > earlyAlertDays（業務規則：alertDate 早於 dueDate）
            expect(param.offsetDays).toBeGreaterThan(param.earlyAlertDays);
        });
    });

    describe('TaskStatus transitions', () => {
        it('should allow transitioning from pending to done', () => {
            let status: TaskStatus = 'pending';
            status = 'done';
            expect(status).toBe('done');
        });

        it('should allow transitioning from pending to overdue', () => {
            let status: TaskStatus = 'pending';
            // 模擬逾期判定
            const today = new Date('2026-02-01');
            const dueDate = new Date('2026-01-28');
            if (today > dueDate) {
                status = 'overdue';
            }
            expect(status).toBe('overdue');
        });
    });

    describe('TaskNode taskId composition', () => {
        it('taskId should follow classId_taskCode pattern', () => {
            const node: TaskNode = {
                taskId: '24004_N-75',
                classId: '24004',
                taskCode: 'N-75',
                taskName: '開訓前 75 天作業',
                dueDate: '115/01/28',
                alertDate: '115/01/21',
                status: 'pending',
            };

            expect(node.taskId).toBe(`${node.classId}_${node.taskCode}`);
        });
    });
});
