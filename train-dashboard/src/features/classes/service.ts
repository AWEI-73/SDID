import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../core/db';
import type { TrainingClass, CreateClassInput, UpdateClassInput } from './types';

export function getAllClasses(): TrainingClass[] {
  return getDb().prepare('SELECT * FROM training_classes ORDER BY start_date ASC').all() as TrainingClass[];
}

export function getClassById(id: string): TrainingClass | undefined {
  return getDb().prepare('SELECT * FROM training_classes WHERE id = ?').get(id) as TrainingClass | undefined;
}

export function createClass(input: CreateClassInput): TrainingClass {
  const id = uuidv4();
  const now = new Date().toISOString();
  const row = { id, ...input, created_at: now };
  getDb().prepare(`
    INSERT INTO training_classes (id, year_term, code, name, category, training_type,
      start_date, end_date, days, location, room, capacity, status, notes, created_at)
    VALUES (@id, @year_term, @code, @name, @category, @training_type,
      @start_date, @end_date, @days, @location, @room, @capacity, @status, @notes, @created_at)
  `).run({ category: '', training_type: '', days: 0, location: '', room: '', capacity: 0, status: 'planned', notes: '', ...row });
  return getClassById(id)!;
}

export function updateClass(id: string, input: UpdateClassInput): TrainingClass | undefined {
  const existing = getClassById(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...input };
  getDb().prepare(`
    UPDATE training_classes SET year_term=@year_term, code=@code, name=@name,
      category=@category, training_type=@training_type, start_date=@start_date,
      end_date=@end_date, days=@days, location=@location, room=@room,
      capacity=@capacity, status=@status, notes=@notes
    WHERE id=@id
  `).run(updated);
  return getClassById(id);
}

export function deleteClass(id: string): boolean {
  const result = getDb().prepare('DELETE FROM training_classes WHERE id = ?').run(id);
  return result.changes > 0;
}
