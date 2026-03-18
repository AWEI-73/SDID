import type { TrainingClass } from '../classes';
import type { NodeWithDate } from '../nodes';

export interface ClassWithConflict extends TrainingClass {
  hasRoomConflict: boolean;
  hasDateConflict: boolean;
}

export interface UpcomingNode extends NodeWithDate {
  class_name: string;
  days_until: number;
}

export interface DashboardFilters {
  search?: string;
  status?: string;
  year_term?: string;
}
