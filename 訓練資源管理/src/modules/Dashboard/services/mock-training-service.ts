// src/modules/Dashboard/services/mock-training-service.ts (由 draft-to-plan 自動生成)

/**
 * GEMS: MockTrainingService | P1 | ○○ | (args)→Result | Story-2.0 | Mock 訓練服務
 * GEMS-FLOW: LOAD_FIXTURE→EXPAND_NODES→RETURN
 * GEMS-DEPS: [shared/interfaces, shared/types]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: mock-training-service.test.ts
 */
// AC-1.2

export interface ITrainingService {
  fetchClasses(): Promise<any[]>;
  fetchTaskNodes(classId: string): Promise<any[]>;
  updateTaskStatus(taskId: string, status: any): Promise<void>;
}

export function MockTrainingService(/* TODO */) {
  // [STEP] LOAD_FIXTURE
  const fixture = null;
  // [STEP] EXPAND_NODES
  const nodes: any[] = [];
  // [STEP] RETURN
  return nodes;
}
