// src/config/__tests__/core-types.e2e.test.ts
// E2E tests for CoreTypes — end-to-end data flow simulation

import type { TrainingClass, TaskNode, NodeParamConfig, TaskStatus } from '../core-types';
import { _taskStatusCheck } from '../core-types';

/**
 * E2E 模擬：完整的訓練班期 → 任務節點 → 狀態更新流程
 */
describe('CoreTypes — E2E', () => {
    /** 模擬 Google Sheets 讀入的原始班期資料 */
    const mockRawClasses: TrainingClass[] = [
        {
            classId: '24004',
            yearPeriod: '115',
            classCode: 'A001',
            className: '基礎訓練班',
            organizer: '訓練組',
            venue: '台北訓練中心',
            startDate: '115/04/13',
            endDate: '115/04/15',
            headcount: 30,
            trainingDays: 3,
            deliveryMode: '實體',
        },
        {
            classId: '77006',
            yearPeriod: '115',
            classCode: 'B002',
            className: '進階訓練班',
            organizer: '人事處',
            venue: '視訊',
            startDate: '115/05/01',
            endDate: '115/05/03',
            headcount: 20,
            trainingDays: 3,
            deliveryMode: '線上',
        },
    ];

    /** 模擬節點參數設定 */
    const mockNodeParams: NodeParamConfig[] = [
        { taskCode: 'N-75', taskName: '開訓前 75 天作業', offsetDays: 75, earlyAlertDays: 7 },
        { taskCode: 'N-14', taskName: '開訓前 14 天確認', offsetDays: 14, earlyAlertDays: 3 },
    ];

    /**
     * 模擬 computeNodeDates 邏輯（E2E 驗證資料流，非測試實作）
     */
    function expandTaskNodes(classes: TrainingClass[], params: NodeParamConfig[]): TaskNode[] {
        const nodes: TaskNode[] = [];
        for (const cls of classes) {
            // 民國年轉西元年（115 + 1911 = 2026）
            const [rocYear, month, day] = cls.startDate.split('/').map(Number);
            const startDate = new Date(rocYear + 1911, month - 1, day);

            for (const param of params) {
                const dueDate = new Date(startDate);
                dueDate.setDate(dueDate.getDate() - param.offsetDays);

                const alertDate = new Date(dueDate);
                alertDate.setDate(alertDate.getDate() - param.earlyAlertDays);

                const today = new Date('2026-03-01');
                let status: TaskStatus = 'pending';
                if (today > dueDate) status = 'overdue';

                nodes.push({
                    taskId: `${cls.classId}_${param.taskCode}`,
                    classId: cls.classId,
                    taskCode: param.taskCode,
                    taskName: param.taskName,
                    dueDate: dueDate.toISOString().slice(0, 10),
                    alertDate: alertDate.toISOString().slice(0, 10),
                    status,
                });
            }
        }
        return nodes;
    }

    it('should expand 2 classes × 2 params = 4 TaskNodes', () => {
        const nodes = expandTaskNodes(mockRawClasses, mockNodeParams);
        expect(nodes).toHaveLength(4);
    });

    it('all TaskNodes should have valid TaskStatus', () => {
        const nodes = expandTaskNodes(mockRawClasses, mockNodeParams);
        nodes.forEach(node => {
            expect(Object.keys(_taskStatusCheck)).toContain(node.status);
        });
    });

    it('taskId should be composed of classId_taskCode', () => {
        const nodes = expandTaskNodes(mockRawClasses, mockNodeParams);
        nodes.forEach(node => {
            expect(node.taskId).toBe(`${node.classId}_${node.taskCode}`);
        });
    });

    it('dueDate should be before startDate', () => {
        const nodes = expandTaskNodes(mockRawClasses, mockNodeParams);
        // 24004 班, startDate = 2026/04/13
        const nodesFor24004 = nodes.filter(n => n.classId === '24004');
        nodesFor24004.forEach(node => {
            const due = new Date(node.dueDate);
            const start = new Date('2026-04-13');
            expect(due.getTime()).toBeLessThan(start.getTime());
        });
    });

    it('alertDate should be before dueDate', () => {
        const nodes = expandTaskNodes(mockRawClasses, mockNodeParams);
        nodes.forEach(node => {
            const alert = new Date(node.alertDate);
            const due = new Date(node.dueDate);
            expect(alert.getTime()).toBeLessThan(due.getTime());
        });
    });
});
