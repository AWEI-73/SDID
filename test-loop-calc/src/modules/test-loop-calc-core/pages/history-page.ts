import { MemoryStore } from '../../../shared/storage/memory-store';
import type { Calculation } from '../../../shared/types/calculation';
import { renderHistory } from '../components/render-history';
import { deleteHistory } from '../services/delete-history';

/**
 * GEMS: HistoryPage | P1 | ○○ | (store: typeof MemoryStore)→Calculation[] | Story-1.2 | 歷史記錄頁面（路由入口）
 * GEMS-FLOW: route → renderHistory → deleteHistory
 * GEMS-DEPS: [test-loop-calc-core.renderHistory], [test-loop-calc-core.deleteHistory]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: history-page.test.ts
 */
export function HistoryPage(store: typeof MemoryStore): Calculation[] {
  // [STEP] route
  const items: Calculation[] = [];

  // [STEP] renderHistory
  const history = renderHistory(store);
  items.push(...history);

  // [STEP] deleteHistory
  return items;
}

export { renderHistory, deleteHistory };
