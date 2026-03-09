import { CalculatorPage } from '../calculator-page';

describe('CalculatorPage', () => {
  it('should have route /', () => {
    expect(CalculatorPage.route).toBe('/');
  });

  it('should have title Calculator', () => {
    expect(CalculatorPage.title).toBe('Calculator');
  });
});
