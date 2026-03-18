export interface TrainingClass {
  id: string;
  year_term: string;
  code: string;
  name: string;
  category: string;
  training_type: string;
  start_date: string;
  end_date: string;
  days: number;
  location: string;
  room: string;
  capacity: number;
  status: string;
  notes: string;
  created_at: string;
}

export interface ClassNode {
  id: string;
  class_id: string;
  name: string;
  offset_days: number;
  notes: string;
  created_at: string;
}

export interface NodeTemplate {
  id: string;
  name: string;
  is_default: number;
}

export interface NodeTemplateItem {
  id: string;
  template_id: string;
  name: string;
  offset_days: number;
  sort_order: number;
}
