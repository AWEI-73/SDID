import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../core/db';
import { calcNodeDate } from './lib/calc-node-date';
import { generateIcs } from './lib/generate-ics';
import type { ClassNode, CreateNodeInput, UpdateNodeInput, NodeWithDate } from './types';

export function getNodesByClass(classId: string, startDate?: string): NodeWithDate[] {
  const nodes = getDb()
    .prepare('SELECT * FROM class_nodes WHERE class_id = ? ORDER BY offset_days ASC')
    .all(classId) as ClassNode[];

  return nodes.map(n => ({
    ...n,
    actual_date: startDate ? calcNodeDate(startDate, n.offset_days) : null,
  }));
}

export function createNode(classId: string, input: CreateNodeInput): ClassNode {
  const id = uuidv4();
  const now = new Date().toISOString();
  getDb().prepare(
    'INSERT INTO class_nodes (id, class_id, name, offset_days, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, classId, input.name, input.offset_days, input.notes ?? '', now);
  return getDb().prepare('SELECT * FROM class_nodes WHERE id = ?').get(id) as ClassNode;
}

export function updateNode(id: string, input: UpdateNodeInput): ClassNode | undefined {
  const existing = getDb().prepare('SELECT * FROM class_nodes WHERE id = ?').get(id) as ClassNode | undefined;
  if (!existing) return undefined;
  const updated = { ...existing, ...input };
  getDb().prepare(
    'UPDATE class_nodes SET name=?, offset_days=?, notes=? WHERE id=?'
  ).run(updated.name, updated.offset_days, updated.notes, id);
  return getDb().prepare('SELECT * FROM class_nodes WHERE id = ?').get(id) as ClassNode;
}

export function deleteNode(id: string): boolean {
  const result = getDb().prepare('DELETE FROM class_nodes WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getIcsForClass(classId: string, className: string, startDate: string): string {
  const nodes = getNodesByClass(classId, startDate);
  return generateIcs(className, nodes);
}

export function getTemplates() {
  return getDb().prepare('SELECT * FROM node_templates').all();
}

export function applyTemplate(classId: string, templateId: string): ClassNode[] {
  const items = getDb()
    .prepare('SELECT * FROM node_template_items WHERE template_id = ? ORDER BY sort_order ASC')
    .all(templateId) as any[];
  const now = new Date().toISOString();
  const stmt = getDb().prepare(
    'INSERT INTO class_nodes (id, class_id, name, offset_days, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const item of items) {
    stmt.run(uuidv4(), classId, item.name, item.offset_days, '', now);
  }
  return getDb().prepare('SELECT * FROM class_nodes WHERE class_id = ?').all(classId) as ClassNode[];
}
