// src/config/__tests__/i-training-service.test.ts
// Unit tests for isITrainingService

import { isITrainingService } from '../i-training-service';
import type { TrainingClass, TaskNode, TaskStatus } from '../core-types';

const validService = {
    async fetchClasses(): Promise<TrainingClass[]> { return []; },
    async fetchTaskNodes(_id: string): Promise<TaskNode[]> { return []; },
    async updateTaskStatus(_taskId: string, _status: TaskStatus): Promise<void> { return; },
};

describe('isITrainingService', () => {
    it('returns true for valid service with all required methods', () => {
        expect(isITrainingService(validService)).toBe(true);
    });

    it('returns false for null', () => {
        expect(isITrainingService(null)).toBe(false); // expected false
    });

    it('returns false for undefined', () => {
        expect(isITrainingService(undefined)).toBe(false); // expected false
    });

    it('returns false for object missing fetchClasses', () => {
        const svc = {
            fetchTaskNodes: async () => [],
            updateTaskStatus: async () => undefined,
        };
        expect(isITrainingService(svc)).toBe(false); // expected false
    });

    it('returns false for object missing fetchTaskNodes', () => {
        const svc = {
            fetchClasses: async () => [],
            updateTaskStatus: async () => undefined,
        };
        expect(isITrainingService(svc)).toBe(false); // expected false
    });

    it('returns false for object missing updateTaskStatus', () => {
        const svc = {
            fetchClasses: async () => [],
            fetchTaskNodes: async () => [],
        };
        expect(isITrainingService(svc)).toBe(false); // expected false
    });

    it('returns false for non-function fetchClasses', () => {
        expect(isITrainingService({ fetchClasses: 'str', fetchTaskNodes: () => [], updateTaskStatus: () => Promise.resolve() })).toBe(false); // expected false
    });

    it('returns false for primitive string', () => {
        expect(isITrainingService('service')).toBe(false); // expected false
    });

    it('returns false for number', () => {
        expect(isITrainingService(42)).toBe(false); // expected false
    });

    it('returns true for service with optional fetchNodeParams', () => {
        const svcWithOptional = {
            ...validService,
            fetchNodeParams: async () => [],
        };
        expect(isITrainingService(svcWithOptional)).toBe(true);
    });
});
