import { EmissionFactor } from '../types/core-types';
import { dbClient } from '../storage/db-client';

const cache = new Map<string, EmissionFactor>();

// [STEP] VALIDATE
function validate(data: Partial<EmissionFactor>): void {
  if (!data.name) throw new Error('name required');
  if (!data.category) throw new Error('category required');
  if (data.value == null || data.value < 0) throw new Error('invalid value');
}

// [STEP] PERSIST
async function persist(data: EmissionFactor): Promise<EmissionFactor> {
  await dbClient.query(
    'INSERT INTO emission_factors (id, name, category, value, unit, source, year) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [data.id, data.name, data.category, data.value, data.unit, data.source, data.year]
  );
  return data;
}

// [STEP] CACHE
function updateCache(factor: EmissionFactor): void {
  cache.set(factor.id, factor);
}

// [STEP] RETURN
/**
 * GEMS: factorService | P1 | ✓✓ | (args)→Result | Story-1.0 | 排放係數 CRUD
 * GEMS-FLOW: VALIDATE→PERSIST→CACHE→RETURN
 * GEMS-DEPS: [Internal.CoreTypes, Internal.dbClient]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: factor-service.test.ts
 */
export const factorService = {
  create: async (data: EmissionFactor) => {
    validate(data);
    const result = await persist(data);
    updateCache(result);
    return result;
  },
  getById: async (id: string) => {
    if (cache.has(id)) return cache.get(id)!;
    const result = await dbClient.query('SELECT * FROM emission_factors WHERE id=$1', [id]);
    return result.rows[0] as EmissionFactor | undefined;
  },
  delete: async (id: string) => {
    cache.delete(id);
    await dbClient.query('DELETE FROM emission_factors WHERE id=$1', [id]);
  },
};
