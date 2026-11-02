import { randomBytes } from 'node:crypto';

// Never let database-writing E2E tests silently use the development database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'Set TEST_DATABASE_URL to a migrated MySQL database ending in _test',
  );
}

const database = new URL(testDatabaseUrl);
if (
  database.protocol !== 'mysql:' ||
  !/^\/[a-zA-Z0-9_]+_test$/.test(database.pathname)
) {
  throw new Error(
    'TEST_DATABASE_URL must select a MySQL database ending in _test',
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '900';
