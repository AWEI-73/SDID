import { MemoryStore } from '../../../shared/storage/memory-store';

/**
 * GEMS: deleteHistory | P1 | ○○ | (store: typeof MemoryStore, id: string)→boolean | Story-1.2 | 刪除歷史記錄
 * GEMS-FLOW: UI → SVC → storage
 * GEMS-DEPS: [Shared.MemoryStore], [Shared.CoreTypes]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: delete-history.test.ts
 */
export function deleteHistory(store: typeof MemoryStore, id: string): boolean {
  // [STEP] UI
  if (!id) return false;

  // [STEP] SVC
  const result = store.deleteById(id);

  // [STEP] storage
  return result;
}
