import { MemoryStore } from '../memory-store';
import { Calculation } from '../../types/calculation';

describe('MemoryStore', () => {
  beforeEach(() => {
    MemoryStore.clear();
  });

  it('should return empty array initially', () => {
    expect(MemoryStore.getAll()).toEqual([]);
  });

  it('should add and retrieve a calculation', () => {
    const calc: Calculation = { id: '1', expression: '2 + 3', result: 5, createdAt: '2026-03-09' };
    MemoryStore.add(calc);
    expect(MemoryStore.getAll()).toHaveLength(1);
    expect(MemoryStore.getAll()[0]).toEqual(calc);
  });

  it('should delete a calculation by id', () => {
    const calc: Calculation = { id: '1', expression: '2 + 3', result: 5, createdAt: '2026-03-09' };
    MemoryStore.add(calc);
    const deleted = MemoryStore.deleteById('1');
    expect(deleted).toBe(true);
    expect(MemoryStore.getAll()).toHaveLength(0);
  });

  it('should return false when deleting non-existent id', () => {
    const deleted = MemoryStore.deleteById('non-existent');
    expect(deleted).toBe(false); // expected false — 刪除不存在的 id 應回傳 false
  });
});
