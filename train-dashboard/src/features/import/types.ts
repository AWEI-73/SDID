export interface CsvRow {
  year_term: string;
  code: string;
  name: string;
  category?: string;
  training_type?: string;
  start_date: string;
  end_date: string;
  days?: string;
  location?: string;
  room?: string;
  capacity?: string;
  status?: string;
  notes?: string;
}

export interface ParseResult {
  valid: CsvRow[];
  errors: Array<{ row: number; message: string }>;
}
