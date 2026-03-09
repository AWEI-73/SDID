import { Organization, EmissionRecord, EmissionFactor, CoreTypes } from '../core-types';

describe('CoreTypes', () => {
  it('should define Organization type', () => {
    const org: Organization = { id: '1', name: 'Test', industry: 'Manufacturing', reportYear: 2026 };
    expect(org.id).toBe('1');
  });

  it('should define EmissionRecord type', () => {
    const record: EmissionRecord = {
      id: '1', orgId: '1', scope: 'SCOPE1', category: 'electricity',
      amount: 100, unit: 'kWh', factorId: '1', co2e: 50, period: '2026-01'
    };
    expect(record.scope).toBe('SCOPE1');
  });

  it('should define EmissionFactor type', () => {
    const factor: EmissionFactor = {
      id: '1', name: 'Grid', category: 'electricity', value: 0.5, unit: 'kgCO2e/kWh', source: 'EPA', year: 2026
    };
    expect(factor.value).toBe(0.5);
  });
});
