import type { CsvRow, ParseResult } from '../types';

const REQUIRED_FIELDS = ['year_term', 'code', 'name', 'start_date', 'end_date'] as const;

export function parseCsv(csvText: string): ParseResult {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { valid: [], errors: [{ row: 0, message: 'Empty file' }] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const valid: CsvRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

    const missing = REQUIRED_FIELDS.filter(f => !row[f]);
    if (missing.length > 0) {
      errors.push({ row: i + 1, message: `Missing required fields: ${missing.join(', ')}` });
      continue;
    }
    valid.push(row as unknown as CsvRow);
  }

  return { valid, errors };
}
