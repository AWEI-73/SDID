import { Calculation } from '../calculation';

describe('Calculation', () => {
  it('should create a valid Calculation object', () => {
    const calc: Calculation = {
      id: 'uuid-1',
      expression: '2 + 3',
      result: 5,
      createdAt: '2026-03-09T00:00:00.000Z',
    };
    expect(calc.id).toBe('uuid-1');
    expect(calc.expression).toBe('2 + 3');
    expect(calc.result).toBe(5);
    expect(calc.createdAt).toBe('2026-03-09T00:00:00.000Z');
  });
});
