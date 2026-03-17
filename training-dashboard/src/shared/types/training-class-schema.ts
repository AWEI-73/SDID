/**
 * GEMS: TrainingClassSchema | P0 | ✓✓ | ()→TrainingClass | Story-1.0 | 訓練班別型別定義與 SQLite Schema
 * GEMS-FLOW: DEFINE→FREEZE→EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 */
// AC-1.0
// [STEP] DEFINE — 定義四大維度欄位型別
// [STEP] FREEZE — 凍結 ScheduleStatus enum
// [STEP] EXPORT — 匯出所有型別

export type ScheduleStatus = 'pending' | 'scheduled' | 'adjusted';

export interface TrainingClass {
  id: number;
  // 班別基本資訊
  yearPeriod: string;
  classCode: string;
  className: string;
  competencyType: string;
  trainingCategory: string;
  trainingSubCategory: string;
  deliveryMode: string;
  // 時程與規模
  startDate: string;       // ISO8601
  endDate: string;         // ISO8601
  trainingDays: number;
  weekNumber: number;
  noticeDate: string | null;
  registrationDeadline: string | null;
  headcount: number;
  // 場地與資源
  organizer: string;
  venue: string;
  useComputerRoom: boolean;
  assignedRoom: string | null;
  coordinator: string | null;
  // 狀態與排程
  sortOrder: number | null;
  scheduleStatus: ScheduleStatus;
  adjustReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateTrainingClassInput = Omit<TrainingClass, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTrainingClassInput = Partial<CreateTrainingClassInput>;

export interface ConflictFlag {
  classId: number;
  type: 'room_conflict' | 'date_overlap';
  conflictWith: number;
  description: string;
}

export interface ImportPreview {
  rows: Partial<TrainingClass>[];
  errors: string[];
  duplicates: number[];
}

/** SQLite CREATE TABLE DDL — 與 TrainingClass 欄位一一對應 */
export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS training_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_period TEXT NOT NULL DEFAULT '',
  class_code TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL,
  competency_type TEXT NOT NULL DEFAULT '',
  training_category TEXT NOT NULL DEFAULT '',
  training_sub_category TEXT NOT NULL DEFAULT '',
  delivery_mode TEXT NOT NULL DEFAULT '實體',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  training_days INTEGER NOT NULL DEFAULT 0,
  week_number INTEGER NOT NULL DEFAULT 0,
  notice_date TEXT,
  registration_deadline TEXT,
  headcount INTEGER NOT NULL DEFAULT 0,
  organizer TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  use_computer_room INTEGER NOT NULL DEFAULT 0,
  assigned_room TEXT,
  coordinator TEXT,
  sort_order INTEGER,
  schedule_status TEXT NOT NULL DEFAULT 'pending',
  adjust_reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;
