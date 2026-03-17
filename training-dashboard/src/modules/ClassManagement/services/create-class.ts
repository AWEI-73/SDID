import { getDatabase } from '../../../shared/storage/init-database';
import type { TrainingClass, CreateTrainingClassInput } from '../../../shared/types/training-class-schema';

/**
 * GEMS: createClass | P0 | ✓✓ | (input: CreateTrainingClassInput)→TrainingClass | Story-1.3 | 新增班別
 * GEMS-FLOW: BODY→VALIDATE→INSERT→RETURN
 * GEMS-DEPS: [TrainingClassSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// AC-1.5
// [STEP] BODY — 接收新增資料
// [STEP] VALIDATE — 驗證必填欄位
// [STEP] INSERT — 寫入 SQLite
// [STEP] RETURN — 回傳完整記錄

export function createClass(input: CreateTrainingClassInput): TrainingClass {
  // [STEP] VALIDATE
  if (!input.className) throw new Error('班別名稱為必填');
  if (!input.startDate) throw new Error('開始日期為必填');
  if (!input.endDate) throw new Error('結束日期為必填');

  // [STEP] INSERT
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO training_classes (
      year_period, class_code, class_name, competency_type,
      training_category, training_sub_category, delivery_mode,
      start_date, end_date, training_days, week_number,
      notice_date, registration_deadline, headcount,
      organizer, venue, use_computer_room, assigned_room,
      coordinator, sort_order, schedule_status, adjust_reason, notes
    ) VALUES (
      @yearPeriod, @classCode, @className, @competencyType,
      @trainingCategory, @trainingSubCategory, @deliveryMode,
      @startDate, @endDate, @trainingDays, @weekNumber,
      @noticeDate, @registrationDeadline, @headcount,
      @organizer, @venue, @useComputerRoom, @assignedRoom,
      @coordinator, @sortOrder, @scheduleStatus, @adjustReason, @notes
    )
  `);

  const result = stmt.run({
    yearPeriod: input.yearPeriod ?? '',
    classCode: input.classCode ?? '',
    className: input.className,
    competencyType: input.competencyType ?? '',
    trainingCategory: input.trainingCategory ?? '',
    trainingSubCategory: input.trainingSubCategory ?? '',
    deliveryMode: input.deliveryMode ?? '實體',
    startDate: input.startDate,
    endDate: input.endDate,
    trainingDays: input.trainingDays ?? 0,
    weekNumber: input.weekNumber ?? 0,
    noticeDate: input.noticeDate ?? null,
    registrationDeadline: input.registrationDeadline ?? null,
    headcount: input.headcount ?? 0,
    organizer: input.organizer ?? '',
    venue: input.venue ?? '',
    useComputerRoom: input.useComputerRoom ? 1 : 0,
    assignedRoom: input.assignedRoom ?? null,
    coordinator: input.coordinator ?? null,
    sortOrder: input.sortOrder ?? null,
    scheduleStatus: input.scheduleStatus ?? 'pending',
    adjustReason: input.adjustReason ?? null,
    notes: input.notes ?? null,
  });

  // [STEP] RETURN
  const row = db.prepare('SELECT * FROM training_classes WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
  return rowToClass(row);
}

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
