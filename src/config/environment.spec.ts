import { parseTrustProxy, validateEnvironment } from './environment';

const production = {
  NODE_ENV: 'production',
  JWT_SECRET: 'production-test-secret-at-least-32-bytes',
  JWT_EXPIRES_IN: '900',
  DATABASE_URL:
    'mysql://hotel_app:private-test-password@mysql:3306/hotel_booking',
  REDIS_URL: 'redis://:private-redis-test-password@redis:6379/0',
};

describe('Deployment environment validation', () => {
  it('defaults production to shared Redis and does not trust forwarded headers', () => {
    expect(validateEnvironment(production)).toMatchObject({
      NODE_ENV: 'production',
      PORT: 3000,
      JWT_EXPIRES_IN: 900,
      RATE_LIMIT_STORAGE: 'redis',
      RATE_LIMIT_PREFIX: 'hotel-booking:production:rate-limit',
      TRUST_PROXY: 'false',
    });
  });

  it('keeps local memory storage available for development and mocked tests', () => {
    expect(validateEnvironment({ NODE_ENV: 'test' })).toMatchObject({
      RATE_LIMIT_STORAGE: 'memory',
    });
  });

  it.each([
    ['JWT_SECRET', undefined],
    ['JWT_SECRET', 'short'],
    ['JWT_SECRET', 'replace-with-your-own-production-secret'],
    ['JWT_EXPIRES_IN', '0'],
    ['JWT_EXPIRES_IN', '-10'],
    ['JWT_EXPIRES_IN', '1.5'],
    ['PORT', '65536'],
    ['PORT', 'not-a-port'],
    ['DATABASE_URL', undefined],
    ['DATABASE_URL', 'mysql://root:change_me@mysql:3306/hotel'],
    ['DATABASE_URL', 'postgres://user:private@host/db'],
    ['DATABASE_URL', 'mysql://user:private@host'],
    ['REDIS_URL', undefined],
    ['REDIS_URL', 'redis://redis:6379'],
    ['REDIS_URL', 'redis://:change_me@redis:6379'],
    ['REDIS_URL', 'http://redis:6379'],
    ['RATE_LIMIT_STORAGE', 'memory'],
    ['RATE_LIMIT_STORAGE', 'other'],
    ['RATE_LIMIT_PREFIX', '{unsafe}'],
    ['RATE_LIMIT_PREFIX', ''],
    ['NODE_ENV', 'prod'],
    ['TRUST_PROXY', 'true'],
    ['TRUST_PROXY', '1'],
  ])(
    'rejects invalid %s without including its supplied value',
    (key, value) => {
      expect(() =>
        validateEnvironment({ ...production, [key]: value }),
      ).toThrow(Error);
    },
  );

  it('does not reveal invalid secrets or connection URLs in validation errors', () => {
    for (const [field, value] of [
      ['DATABASE_URL', 'bad-url-with-password-secret-marker'],
      ['REDIS_URL', 'http://user:secret-marker@host'],
      ['JWT_SECRET', 'secret-marker'],
    ]) {
      try {
        validateEnvironment({ ...production, [field]: value });
        throw new Error('Expected validation to reject this input');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(field);
        expect((error as Error).message).not.toContain('secret-marker');
      }
    }
  });

  it('accepts URL-encoded production credentials without changing them', () => {
    const url =
      'mysql://hotel_app:private%40password%23value@mysql:3306/hotel_booking';
    expect(
      validateEnvironment({ ...production, DATABASE_URL: url }),
    ).toHaveProperty('DATABASE_URL', url);
  });
});

describe('Explicit trust proxy parsing', () => {
  it('disables trust unless explicitly configured', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('accepts known addresses and bounded subnets', () => {
    expect(parseTrustProxy('loopback,10.20.0.2,172.20.0.0/24,::1')).toEqual([
      'loopback',
      '10.20.0.2',
      '172.20.0.0/24',
      '::1',
    ]);
  });

  it.each([
    'true',
    '1',
    '0.0.0.0/0',
    '::/0',
    '10.0.0.1/33',
    '::1/129',
    '10.0.0.1/',
    'localhost',
    'loopback,',
    '*',
  ])('rejects overly broad or invalid trust setting %s', (value) => {
    expect(() => parseTrustProxy(value)).toThrow('TRUST_PROXY');
  });
});
