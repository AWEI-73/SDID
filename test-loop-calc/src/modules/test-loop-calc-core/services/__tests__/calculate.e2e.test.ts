import { calculate } from '../calculate';
import { MemoryStore } from '../../../../shared/storage/memory-store';

describe('calculate - e2e', () => {
  beforeEach(() => {
    MemoryStore.clear();
  });

  it('should complete full calculation flow: expression → result → stored', () => {
    const calc = calculate('10 * 3 - 5');
    expect(calc.result).toBe(25);
    expect(calc.expression).toBe('10 * 3 - 5');
    expect(typeof calc.id).toBe('string');
    expect(typeof calc.createdAt).toBe('string');
    const stored = MemoryStore.getAll().find(c => c.id === calc.id);
    expect(stored).toEqual(calc);
  });

  it('should handle division in full flow', () => {
    const calc = calculate('100 / 4');
    expect(calc.result).toBe(25);
    const stored = MemoryStore.getAll();
    expect(stored).toHaveLength(1);
  });
});
