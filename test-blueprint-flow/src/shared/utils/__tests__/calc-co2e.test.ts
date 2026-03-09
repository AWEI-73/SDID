import { calcCo2e } from '../calc-co2e';

describe('calcCo2e', () => {
  it('AC-1.3: 100 kWh * 0.502 factor = 50.2 kgCO2e', () => {
    expect(calcCo2e(100, 0.502)).toEqual(50.2);
  });

  it('AC-1.3b: 0 amount = 0 CO2e', () => {
    expect(calcCo2e(0, 0.502)).toEqual(0);
  });

  it('AC-1.3c: 1000 * 0.001 = 1', () => {
    expect(calcCo2e(1000, 0.001)).toEqual(1);
  });

  it('should throw on negative amount', () => {
    expect(() => calcCo2e(-1, 0.5)).toThrow('amount must be >= 0');
  });

  it('should throw on negative factor', () => {
    expect(() => calcCo2e(100, -1)).toThrow('factor must be >= 0');
  });
});
