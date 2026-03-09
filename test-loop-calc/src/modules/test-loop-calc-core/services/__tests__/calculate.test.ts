import { calculate } from '../calculate';
import { MemoryStore } from '../../../../shared/storage/memory-store';

describe('calculate', () => {
  beforeEach(() => {
    MemoryStore.clear();
  });

  it('should return a Calculation with correct result', () => {
    const result = calculate('2 + 3');
    expect(result.result).toBe(5);
    expect(result.expression).toBe('2 + 3');
  });

  it('should assign a unique id', () => {
    const a = calculate('1 + 1');
    const b = calculate('2 + 2');
    expect(a.id).not.toBe(b.id);
  });

  it('should throw on invalid expression', () => {
    expect(() => calculate('abc')).toThrow();
  });
});
