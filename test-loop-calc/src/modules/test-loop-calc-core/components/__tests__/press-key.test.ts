import { pressKey } from '../press-key';

describe('pressKey', () => {
  it('should append key to display', () => {
    expect(pressKey('5', '12')).toBe('125');
  });

  it('should replace 0 with key', () => {
    expect(pressKey('3', '0')).toBe('3');
  });

  it('should replace Error with key', () => {
    expect(pressKey('1', 'Error')).toBe('1');
  });
});
