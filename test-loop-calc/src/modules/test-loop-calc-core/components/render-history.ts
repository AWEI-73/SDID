import { MemoryStore } from '../../../shared/storage/memory-store';
import type { Calculation } from '../../../shared/types/calculation';

/**
 * GEMS: renderHistory | P1 | ○○ | (store: typeof MemoryStore)→Calculation[] | Story-1.2 | 渲染歷史列表
 * GEMS-FLOW: storage → UI
 * GEMS-DEPS: [Shared.MemoryStore], [Shared.CoreTypes]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: render-history.test.ts
 */
export function renderHistory(store: typeof MemoryStore): Calculation[] {
  // [STEP] storage
  const items = store.getAll();

  // [STEP] UI
  return items;
}
