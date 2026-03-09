/**
 * GEMS: MemoryStore | P0 | ✓✓ | (args)→Result | Story-1.0 | 記憶體儲存層
 * GEMS-FLOW: storage → shared
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: memory-store.test.ts
 */
// [STEP] storage
// [STEP] local

import { Calculation } from '../types/calculation';

let store: Calculation[] = [];

export const MemoryStore = {
  getAll(): Calculation[] {
    return [...store];
  },

  add(item: Calculation): void {
    store.push(item);
  },

  deleteById(id: string): boolean {
    const before = store.length;
    store = store.filter(c => c.id !== id);
    return store.length < before;
  },

  clear(): void {
    store = [];
  },
};
