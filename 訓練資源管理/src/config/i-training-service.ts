// src/config/i-training-service.ts (由 draft-to-plan 自動生成)

/**
 * @GEMS-FUNCTION: ITrainingService
 * GEMS: ITrainingService | P1 | ○○ | (args)→Result | Story-1.0 | 訓練服務介面契約
 * GEMS-FLOW: DEFINE→VALIDATE→EXPORT
 * GEMS-DEPS: [Internal.CoreTypes]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: i-training-service.test.ts
 */
// AC-0.1

import type { TrainingClass, TaskNode, TaskStatus, NodeParamConfig } from './core-types';

// [STEP] DEFINE
/** 訓練資料服務的介面契約（實作可為 MockTrainingService 或 GasTrainingService）*/
export interface ITrainingService {
  /** 取得所有訓練班期清單 */
  fetchClasses(): Promise<TrainingClass[]>;
  /** 取得指定班期的所有任務節點 */
  fetchTaskNodes(classId: string): Promise<TaskNode[]>;
  /** 更新任務狀態 */
  updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;
  /** 取得節點參數配置（可選）*/
  fetchNodeParams?(): Promise<NodeParamConfig[]>;
}

// [STEP] VALIDATE
/**
 * @GEMS-FUNCTION: isITrainingService
 * GEMS: isITrainingService | P0 | ○○ | (obj: unknown)→boolean | Story-1.0 | 服務實作完整性型別守衛
 * GEMS-FLOW: VALIDATE
 * GEMS-DEPS: [Internal.CoreTypes]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: i-training-service.test.ts
 */
export function isITrainingService(obj: unknown): obj is ITrainingService {
  if (typeof obj !== 'object' || obj === null) return false;
  const svc = obj as Record<string, unknown>;
  return (
    typeof svc['fetchClasses'] === 'function' &&
    typeof svc['fetchTaskNodes'] === 'function' &&
    typeof svc['updateTaskStatus'] === 'function'
  );
}

// [STEP] EXPORT
export type { TrainingClass, TaskNode, TaskStatus, NodeParamConfig };
