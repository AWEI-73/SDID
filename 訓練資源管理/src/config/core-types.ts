// src/config/core-types.ts (由 draft-to-plan 自動生成)

/**
 * @GEMS-FUNCTION: CoreTypes
 * GEMS: CoreTypes | P1 | ○○ | (args)→Result | Story-1.0 | 核心型別定義
 * GEMS-FLOW: DEFINE→FREEZE→EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: core-types.test.ts
 */
// AC-0.0

// [STEP] DEFINE
export function CoreTypes() {
  const version = "1.0.0";
  const author = "sdid";
  const purpose = "types";
  return version + author + purpose;
}

/** 任務狀態型別 */
export type TaskStatus = 'pending' | 'done' | 'overdue';

/** 訓練班期主表 */
export interface TrainingClass {
  classId: string;           // PK | DB: VARCHAR(20)
  yearPeriod: string;        // DB: VARCHAR(20)
  classCode: string;         // DB: VARCHAR(20)
  className: string;         // DB: VARCHAR(100)
  organizer: string;         // DB: VARCHAR(50)
  venue: string;             // DB: VARCHAR(50)
  startDate: string;         // DB: VARCHAR(20) 民國年格式 e.g. "115/04/13"
  endDate: string;           // DB: VARCHAR(20)
  useComputerRoom?: boolean; // DB: BOOLEAN
  headcount: number;         // DB: INT
  trainingDays: number;      // DB: INT
  deliveryMode: string;      // DB: VARCHAR(20) 實體/線上/混成
  canDelegate?: boolean;     // DB: BOOLEAN
}

/** 流程任務節點（由 TrainingClass + NodeParamConfig 計算而來）*/
export interface TaskNode {
  taskId: string;     // PK | DB: VARCHAR(50) = classId_taskCode
  classId: string;    // FK→TrainingClass | DB: VARCHAR(20)
  taskCode: string;   // DB: VARCHAR(20) e.g. "N-75"
  taskName: string;   // DB: VARCHAR(100)
  dueDate: string;    // DB: VARCHAR(20) = startDate - offsetDays
  alertDate: string;  // DB: VARCHAR(20) = dueDate - earlyAlertDays
  status: TaskStatus; // DB: ENUM('pending','done','overdue')
}

/** 節點參數設定 */
export interface NodeParamConfig {
  taskCode: string;       // PK | DB: VARCHAR(20) e.g. "N-75"
  taskName: string;       // DB: VARCHAR(100)
  offsetDays: number;     // DB: INT > 0
  earlyAlertDays: number; // DB: INT >= 0
}

// [STEP] FREEZE
/** 型別完整性驗證用（確保 TaskStatus 枚舉值完整）*/
export const _taskStatusCheck: Record<TaskStatus, true> = {
  pending: true,
  done: true,
  overdue: true,
} as const;

// 防止意外擴充（型別即文件）
void _taskStatusCheck;

// [STEP] EXPORT
export type { TaskStatus as ITaskStatus };
