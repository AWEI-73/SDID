import { getDatabase } from '../../../shared/storage/init-database';
import type { TrainingClass } from '../../../shared/types/training-class-schema';

/**
 * GEMS: getClasses | P0 | ✓✓ | ()→TrainingClass[] | Story-1.1 | GET /api/classes — 取得班別列表
 * GEMS-FLOW: API→SQLITE→JSON
 * GEMS-DEPS: [TrainingClassSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// AC-1.1
// [STEP] API — 接收查詢請求
// [STEP] SQLITE — 查詢 training_classes 表
// [STEP] JSON — 轉換 snake_case → camelCase 回傳

function rowToClass(row: Record<string, unknown>): TrainingClass {
  return {
    id: row.id as number,
    yearPeriod: row.year_period as string,
    classCode: row.class_code as string,
    className: row.class_name as string,
    competencyType: row.competency_type as string,
    trainingCategory: row.training_category as string,
    trainingSubCategory: row.training_sub_category as string,
    deliveryMode: row.delivery_mode as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    trainingDays: row.training_days as number,
    weekNumber: row.week_number as number,
    noticeDate: row.notice_date as string | null,
    registrationDeadline: row.registration_deadline as string | null,
    headcount: row.headcount as number,
    organizer: row.organizer as string,
    venue: row.venue as string,
    useComputerRoom: Boolean(row.use_computer_room),
    assignedRoom: row.assigned_room as string | null,
    coordinator: row.coordinator as string | null,
    sortOrder: row.sort_order as number | null,
    scheduleStatus: row.schedule_status as TrainingClass['scheduleStatus'],
    adjustReason: row.adjust_reason as string | null,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function getClasses(): TrainingClass[] {
  // [STEP] SQLITE
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM training_classes ORDER BY start_date ASC').all() as Record<string, unknown>[];
  // [STEP] JSON
  return rows.map(rowToClass);
}

export function getClassById(id: number): TrainingClass | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM training_classes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToClass(row) : null;
}

export { rowToClass };
