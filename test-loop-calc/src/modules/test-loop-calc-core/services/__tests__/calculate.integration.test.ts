import { calculate } from '../calculate';
import { MemoryStore } from '../../../../shared/storage/memory-store';

describe('calculate - integration', () => {
  beforeEach(() => {
    MemoryStore.clear();
  });

  it('should calculate and store result in MemoryStore', () => {
    const result = calculate('2 + 3');
    expect(result.expression).toBe('2 + 3');
    expect(result.result).toBe(5);
    const history = MemoryStore.getAll();
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe(result.id);
  });

  it('should accumulate multiple calculations in store', () => {
    calculate('1 + 1');
    calculate('2 * 3');
    expect(MemoryStore.getAll()).toHaveLength(2);
  });

  it('should throw on invalid expression and not store', () => {
    expect(() => calculate('abc')).toThrow();
    expect(MemoryStore.getAll()).toHaveLength(0);
  });
});
