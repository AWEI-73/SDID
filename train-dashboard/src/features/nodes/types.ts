import type { ClassNode, NodeTemplate, NodeTemplateItem } from '../../core/types';

export type { ClassNode, NodeTemplate, NodeTemplateItem };

export interface CreateNodeInput {
  name: string;
  offset_days: number;
  notes?: string;
}

export interface UpdateNodeInput extends Partial<CreateNodeInput> {}

export interface NodeWithDate extends ClassNode {
  actual_date: string | null;
}
