import { getDatabase } from '../../../shared/storage/init-database';
import type { TrainingClass, UpdateTrainingClassInput } from '../../../shared/types/training-class-schema';

/**
 * GEMS: updateClass | P1 | ✓✓ | (id: number, input: UpdateTrainingClassInput)→TrainingClass | Story-1.3 | 更新班別
 * GEMS-FLOW: ID→BODY→UPDATE→RETURN
 * GEMS-DEPS: [TrainingClassSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] ID — 確認記錄存在
// [STEP] BODY — 接收更新資料
// [STEP] UPDATE — 更新 SQLite
// [STEP] RETURN — 回傳更新後記錄

export function updateClass(id: number, input: UpdateTrainingClassInput): TrainingClass {
  const db = getDatabase();

  // [STEP] ID
  const existing = db.prepare('SELECT id FROM training_classes WHERE id = ?').get(id);
  if (!existing) throw new Error(`班別 ${id} 不存在`);

  // [STEP] BODY + UPDATE
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  const fieldMap: Record<keyof UpdateTrainingClassInput, string> = {
    yearPeriod: 'year_period',
    classCode: 'class_code',
    className: 'class_name',
    competencyType: 'competency_type',
    trainingCategory: 'training_category',
    trainingSubCategory: 'training_sub_category',
    deliveryMode: 'delivery_mode',
    startDate: 'start_date',
    endDate: 'end_date',
    trainingDays: 'training_days',
    weekNumber: 'week_number',
    noticeDate: 'notice_date',
    registrationDeadline: 'registration_deadline',
    headcount: 'headcount',
    organizer: 'organizer',
    venue: 'venue',
    useComputerRoom: 'use_computer_room',
    assignedRoom: 'assigned_room',
    coordinator: 'coordinator',
    sortOrder: 'sort_order',
    scheduleStatus: 'schedule_status',
    adjustReason: 'adjust_reason',
    notes: 'notes',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    const val = input[key as keyof UpdateTrainingClassInput];
    if (val !== undefined) {
      fields.push(`${col} = @${key}`);
      params[key] = key === 'useComputerRoom' ? (val ? 1 : 0) : val;
    }
  }

  if (fields.length === 0) throw new Error('無更新欄位');

  fields.push(`updated_at = datetime('now')`);
  db.prepare(`UPDATE training_classes SET ${fields.join(', ')} WHERE id = @id`).run(params);

  // [STEP] RETURN
  const row = db.prepare('SELECT * FROM training_classes WHERE id = ?').get(id) as Record<string, unknown>;
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
