import type { TrainingClass } from '../../../shared/types/training-class-schema';

/**
 * GEMS: parseCSVRow | P1 | ✓✓ | (row, headers)→Partial<TrainingClass> | Story-1.2 | 解析 CSV 單行為 TrainingClass 欄位
 * GEMS-FLOW: ROW→MAP→TRAININGCLASS
 * GEMS-DEPS: [TrainingClassSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// AC-1.4
// [STEP] ROW — 接收 CSV 行資料與標頭
// [STEP] MAP — 依欄位名稱對應 TrainingClass 欄位
// [STEP] TRAININGCLASS — 回傳 Partial<TrainingClass>

/** CSV 欄位名稱 → TrainingClass 欄位對應表 */
const COLUMN_MAP: Record<string, keyof TrainingClass> = {
  '年度期別': 'yearPeriod',
  '班別代號': 'classCode',
  '班別名稱': 'className',
  '職能屬性': 'competencyType',
  '訓練類別大項': 'trainingCategory',
  '訓練類別細目': 'trainingSubCategory',
  '授課方式': 'deliveryMode',
  '訓練日期起': 'startDate',
  '訓練日期迄': 'endDate',
  '訓練天數': 'trainingDays',
  '週次': 'weekNumber',
  '調訓函建議日': 'noticeDate',
  '報名截止日': 'registrationDeadline',
  '人數': 'headcount',
  '主辦單位': 'organizer',
  '訓練地點': 'venue',
  '使用電腦教室': 'useComputerRoom',
  '指定教室': 'assignedRoom',
  '教輔員': 'coordinator',
  '開班排序': 'sortOrder',
  '調移納編': 'scheduleStatus',
  '需調整原因': 'adjustReason',
  '備註': 'notes',
};

export function parseCSVRow(
  row: Record<string, string>,
  _headers?: string[]
): Partial<TrainingClass> {
  // [STEP] ROW
  const result: Partial<TrainingClass> = {};

  // [STEP] MAP
  for (const [csvKey, fieldKey] of Object.entries(COLUMN_MAP)) {
    const raw = row[csvKey];
    if (raw === undefined || raw === '') continue;

    // [STEP] TRAININGCLASS — 型別轉換
    switch (fieldKey) {
      case 'trainingDays':
      case 'weekNumber':
      case 'headcount':
      case 'sortOrder':
        (result as Record<string, unknown>)[fieldKey] = parseInt(raw, 10) || 0;
        break;
      case 'useComputerRoom':
        (result as Record<string, unknown>)[fieldKey] = raw === 'v' || raw === 'V' || raw === '1' || raw === 'true';
        break;
      case 'scheduleStatus':
        (result as Record<string, unknown>)[fieldKey] = (['pending', 'scheduled', 'adjusted'].includes(raw) ? raw : 'pending');
        break;
      default:
        (result as Record<string, unknown>)[fieldKey] = raw;
    }
  }

  return result;
}

/** 解析 CSV 文字為行陣列（簡易版，不處理引號內逗號） */
export function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
  });

  return { headers, rows };
}
