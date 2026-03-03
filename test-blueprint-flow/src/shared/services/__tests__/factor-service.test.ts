import { factorService } from '../factor-service';
import { EmissionFactor } from '../../types/core-types';

describe('factorService', () => {
  const mockFactor: EmissionFactor = {
    id: '1', name: 'Grid Electricity', category: 'electricity',
    value: 0.502, unit: 'kgCO2e/kWh', source: 'EPA', year: 2026
  };

  it('should create a factor', async () => {
    const result = await factorService.create(mockFactor);
    expect(result.id).toBe('1');
  });

  it('should reject invalid factor', async () => {
    await expect(factorService.create({ ...mockFactor, name: '' }))
      .rejects.toThrow('name required');
  });
});
