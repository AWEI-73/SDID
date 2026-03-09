import { evaluateExpression } from '../evaluate-expression';

describe('evaluateExpression', () => {
  it('AC-1.0: should evaluate 2 + 3 = 5', () => {
    expect(evaluateExpression('2 + 3')).toBe(5);
  });

  it('AC-1.1: should evaluate 10 * 3 - 5 = 25', () => {
    expect(evaluateExpression('10 * 3 - 5')).toBe(25);
  });

  it('AC-1.2: should evaluate 100 / 4 = 25', () => {
    expect(evaluateExpression('100 / 4')).toBe(25);
  });

  it('should throw on invalid expression', () => {
    expect(() => evaluateExpression('abc')).toThrow();
  });
});
