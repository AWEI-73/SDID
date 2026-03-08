// src/config/node_param_config.ts (由 draft-to-plan 自動生成)

/**
 * @GEMS-FUNCTION: NODE_PARAM_CONFIG
 * GEMS: NODE_PARAM_CONFIG | P1 | ○○ | (args)→Result | Story-1.0 | 節點參數配置
 * GEMS-FLOW: DEFINE→EXPORT
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: node_param_config.test.ts
 */
// src/config/node_param_config.ts
// [STEP] DEFINE
// [STEP] EXPORT

// 型別來源: contract_iter-1.ts
// @GEMS-CONTRACT: TrainingClass
// @GEMS-TABLE: tbl_training_classes
export interface TrainingClass {
  id: string; // UUID, PK | DB: VARCHAR(36)
  classId: string; // NOT NULL, UNIQUE | DB: VARCHAR(20)
  yearPeriod: string; // NOT NULL | DB: VARCHAR(20)
  classCode: string; // NOT NULL | DB: VARCHAR(20)
  className: string; // NOT NULL | DB: VARCHAR(100)
  organizer: string; // NOT NULL | DB: VARCHAR(50)
  venue: string; // NOT NULL | DB: VARCHAR(50)
  startDate: string; // NOT NULL | DB: VARCHAR(20)
  endDate: string; // NOT NULL | DB: VARCHAR(20)
  useComputerRoom: boolean; // optional | DB: BOOLEAN
  headcount: number; // NOT NULL | DB: INT
  trainingDays: number; // NOT NULL | DB: INT
  deliveryMode: string; // NOT NULL | DB: VARCHAR(20)
  canDelegate: boolean; // optional | DB: BOOLEAN
}

// @GEMS-CONTRACT: TaskNode
// @GEMS-TABLE: tbl_task_nodes
export interface TaskNode {
  id: string; // UUID, PK | DB: VARCHAR(36)
  taskId: string; // NOT NULL, UNIQUE | DB: VARCHAR(50)
  classId: string; // NOT NULL, FK→tbl_training_classes | DB: VARCHAR(20)
  taskCode: string; // NOT NULL | DB: VARCHAR(20)
  taskName: string; // NOT NULL | DB: VARCHAR(100)
  dueDate: string; // NOT NULL | DB: VARCHAR(20)
  alertDate: string; // NOT NULL | DB: VARCHAR(20)
  status: string; // NOT NULL | DB: ENUM('pending','done','overdue')
}

// @GEMS-CONTRACT: NodeParamConfig
// @GEMS-TABLE: tbl_node_param_configs
export interface NodeParamConfig {
  id: string; // UUID, PK | DB: VARCHAR(36)
  taskCode: string; // NOT NULL, UNIQUE | DB: VARCHAR(20)
  taskName: string; // NOT NULL | DB: VARCHAR(100)
  offsetDays: number; // NOT NULL | DB: INT
  earlyAlertDays: number; // NOT NULL | DB: INT
}
