import type { TrainingClass } from '../../core/types';

export type { TrainingClass };

export interface CreateClassInput {
  year_term: string;
  code: string;
  name: string;
  category?: string;
  training_type?: string;
  start_date: string;
  end_date: string;
  days?: number;
  location?: string;
  room?: string;
  capacity?: number;
  status?: string;
  notes?: string;
}

export interface UpdateClassInput extends Partial<CreateClassInput> {}
