import { computeCo2e } from '../compute-co2e';

describe('computeCo2e', () => {
  it('AC-1.0: 100 kWh * 0.502 factor = 50.2 kgCO2e', () => {
    const result = computeCo2e(...[100, 0.502] as [number, number]);
    expect(result).toEqual(50.2);
  });

  it('AC-1.1: 0 amount = 0 CO2e', () => {
    const result = computeCo2e(...[0, 0.502] as [number, number]);
    expect(result).toEqual(0);
  });

  it('AC-1.2: 1000 * 0.001 = 1', () => {
    const result = computeCo2e(...[1000, 0.001] as [number, number]);
    expect(result).toEqual(1);
  });

  it('should throw on negative amount', () => {
    expect(() => computeCo2e(-1, 0.5)).toThrow('amount must be >= 0');
  });

  it('should throw on negative factor', () => {
    expect(() => computeCo2e(100, -1)).toThrow('factor must be >= 0');
  });
});
