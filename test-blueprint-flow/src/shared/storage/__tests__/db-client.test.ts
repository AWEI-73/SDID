import { dbClient } from '../db-client';

describe('dbClient', () => {
  it('should execute query', async () => {
    const result = await dbClient.query('SELECT 1');
    expect(result).toBeDefined();
    expect(result.rows).toEqual([]);
  });

  it('should health check', async () => {
    const healthy = await dbClient.healthCheck();
    expect(healthy).toBe(true);
  });
});
