export const CSV_HEADERS = [
  'year_term', 'code', 'name', 'category', 'training_type',
  'start_date', 'end_date', 'days', 'location', 'room',
  'capacity', 'status', 'notes'
];

export const CSV_EXAMPLE_ROW = [
  '115-1', 'A001', '基層主管班', '核心技能', '實體',
  '2026-04-01', '2026-04-05', '5', '台北訓練中心', 'A101',
  '30', 'planned', '備註範例'
];

export function generateCsvTemplate(): string {
  return [CSV_HEADERS.join(','), CSV_EXAMPLE_ROW.join(',')].join('\n');
}
