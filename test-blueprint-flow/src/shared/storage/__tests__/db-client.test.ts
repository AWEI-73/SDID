import { dbClient } from '../db-client';

describe('dbClient', () => {
  // AC-1.1: dbClient 資料庫連線
  it('AC-1.1: should execute query and return rows array', async () => {
    const result = await dbClient.query('SELECT 1');
    expect(result.rows).toEqual([]);
    expect(result.sql).toBe('SELECT 1');
  });

  it('AC-1.1: should pass health check when connected', async () => {
    const healthy = await dbClient.healthCheck();
    expect(healthy).toBe(true);
  });

  it('AC-1.1: should include params in query result', async () => {
    const result = await dbClient.query('SELECT * FROM t WHERE id=$1', ['abc']);
    expect(result.params).toEqual(['abc']);
  });
});
