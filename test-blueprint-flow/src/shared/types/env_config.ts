/**
 * GEMS: ENV_CONFIG | P2 | ✓✓ | ()→Config | Story-1.0 | 環境變數管理
 * GEMS-FLOW: LOAD→VALIDATE→EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: env_config.test.ts
 */

// [STEP] LOAD
function loadEnv(): Record<string, string> {
  return {
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_NAME: process.env.DB_NAME || 'ecotrack',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
  };
}

// [STEP] VALIDATE
function validateEnv(env: Record<string, string>): void {
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME'];
  for (const key of required) {
    if (!env[key]) throw new Error(`Missing env: ${key}`);
  }
}

// [STEP] EXPORT
const raw = loadEnv();
validateEnv(raw);

export const ENV_CONFIG = Object.freeze({
  db: {
    host: raw.DB_HOST,
    port: parseInt(raw.DB_PORT, 10),
    name: raw.DB_NAME,
    user: raw.DB_USER,
    password: raw.DB_PASSWORD,
  },
});
