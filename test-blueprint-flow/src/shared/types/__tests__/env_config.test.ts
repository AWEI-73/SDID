import { ENV_CONFIG } from '../env_config';

describe('ENV_CONFIG', () => {
  it('should have db config', () => {
    expect(ENV_CONFIG.db).toBeDefined();
    expect(ENV_CONFIG.db.host).toBe('localhost');
    expect(ENV_CONFIG.db.port).toBe(5432);
  });
});
