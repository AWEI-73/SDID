import { deleteLastChar } from '../delete-last-char';

describe('deleteLastChar', () => {
  it('should remove last character', () => {
    expect(deleteLastChar('123')).toBe('12');
  });

  it('should return 0 when single char', () => {
    expect(deleteLastChar('5')).toBe('0');
  });

  it('should return 0 when empty string', () => {
    expect(deleteLastChar('')).toBe('0');
  });
});
