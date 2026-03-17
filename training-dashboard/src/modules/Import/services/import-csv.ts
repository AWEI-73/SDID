import { getDatabase } from '../../../shared/storage/init-database';
import type { TrainingClass } from '../../../shared/types/training-class-schema';
import { parseCSVText, parseCSVRow } from '../lib/parse-csv-row';

/**
 * GEMS: importCSV | P0 | ✓✓ | (csvText: string)→ImportResult | Story-1.2 | CSV 匯入班別資料到 SQLite
 * GEMS-FLOW: UPLOAD→PARSE→VALIDATE→INSERT
 * GEMS-DEPS: [TrainingClassSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// AC-1.3
// [STEP] UPLOAD — 接收 CSV 文字內容
// [STEP] PARSE — 解析 CSV 行
// [STEP] VALIDATE — 驗證必填欄位
// [STEP] INSERT — 批次寫入 SQLite

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

const REQUIRED_FIELDS: (keyof TrainingClass)[] = ['className', 'startDate', 'endDate'];

function validateRow(row: Partial<TrainingClass>, index: number): string | null {
  for (const field of REQUIRED_FIELDS) {
    if (!row[field]) {
      return `第 ${index + 1} 行缺少必填欄位: ${field}`;
    }
  }
  return null;
}

const INSERT_SQL = `
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
)`;

export function importCSV(csvText: string): ImportResult {
  // [STEP] PARSE
  const { headers, rows } = parseCSVText(csvText);
  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  if (rows.length === 0) {
    result.errors.push('CSV 無資料行');
    return result;
  }

  const db = getDatabase();
  const insert = db.prepare(INSERT_SQL);

  const runBatch = db.transaction(() => {
    rows.forEach((rawRow, i) => {
      // [STEP] VALIDATE
      const parsed = parseCSVRow(rawRow, headers);
      const err = validateRow(parsed, i);
      if (err) {
        result.errors.push(err);
        result.skipped++;
        return;
      }

      // [STEP] INSERT
      try {
        insert.run({
          yearPeriod: parsed.yearPeriod ?? '',
          classCode: parsed.classCode ?? '',
          className: parsed.className ?? '',
          competencyType: parsed.competencyType ?? '',
          trainingCategory: parsed.trainingCategory ?? '',
          trainingSubCategory: parsed.trainingSubCategory ?? '',
          deliveryMode: parsed.deliveryMode ?? '實體',
          startDate: parsed.startDate ?? '',
          endDate: parsed.endDate ?? '',
          trainingDays: parsed.trainingDays ?? 0,
          weekNumber: parsed.weekNumber ?? 0,
          noticeDate: parsed.noticeDate ?? null,
          registrationDeadline: parsed.registrationDeadline ?? null,
          headcount: parsed.headcount ?? 0,
          organizer: parsed.organizer ?? '',
          venue: parsed.venue ?? '',
          useComputerRoom: parsed.useComputerRoom ? 1 : 0,
          assignedRoom: parsed.assignedRoom ?? null,
          coordinator: parsed.coordinator ?? null,
          sortOrder: parsed.sortOrder ?? null,
          scheduleStatus: parsed.scheduleStatus ?? 'pending',
          adjustReason: parsed.adjustReason ?? null,
          notes: parsed.notes ?? null,
        });
        result.inserted++;
      } catch (e) {
        result.errors.push(`第 ${i + 1} 行寫入失敗: ${(e as Error).message}`);
        result.skipped++;
      }
    });
  });

  runBatch();
  return result;
}
