import { isIP } from 'node:net';

export function parseTrustProxy(value: unknown): false | string[] {
  if (
    value === undefined ||
    value === '' ||
    value === 'false' ||
    value === false
  )
    return false;
  if (typeof value !== 'string')
    throw new Error(
      'TRUST_PROXY must be false or explicit proxy addresses/CIDRs',
    );
  const entries = value.split(',').map((entry) => entry.trim());
  for (const entry of entries) {
    if (entry === 'loopback') continue;
    const [address, prefix, extra] = entry.split('/');
    const version = isIP(address);
    if (
      !version ||
      extra !== undefined ||
      (prefix !== undefined &&
        (!/^\d+$/.test(prefix) ||
          Number(prefix) <= 0 ||
          Number(prefix) > (version === 4 ? 32 : 128)))
    )
      throw new Error(
        'TRUST_PROXY must be false or explicit proxy addresses/CIDRs; true and hop counts are not allowed',
      );
  }
  return entries;
}

function integer(
  value: unknown,
  fallback: number,
  field: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const candidate = value ?? fallback;
  if (typeof candidate !== 'string' && typeof candidate !== 'number') {
    throw new Error(
      `${field} must be a positive integer within the supported range`,
    );
  }
  const text = String(candidate);
  const parsed = Number(text);
  if (
    !/^\d+$/.test(text) ||
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    throw new Error(
      `${field} must be a positive integer within the supported range`,
    );
  }
  return parsed;
}

function validateUrl(
  value: unknown,
  field: string,
  protocols: string[],
  required: boolean,
): URL | undefined {
  if (value === undefined && !required) return undefined;
  try {
    if (typeof value !== 'string' || !value.trim()) throw new Error();
    const url = new URL(value);
    if (!protocols.includes(url.protocol) || !url.hostname) throw new Error();
    return url;
  } catch {
    // Never include the input URL: it may contain passwords.
    throw new Error(`${field} must be a valid ${protocols.join('/')} URL`);
  }
}

export function validateEnvironment(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = raw.NODE_ENV ?? 'development';
  if (
    typeof nodeEnv !== 'string' ||
    !['development', 'test', 'production'].includes(nodeEnv)
  ) {
    throw new Error('NODE_ENV must be development, test or production');
  }
  const production = nodeEnv === 'production';
  const secret = raw.JWT_SECRET;
  if (secret !== undefined || production) {
    if (
      typeof secret !== 'string' ||
      !secret.trim() ||
      /^(replace[-_]|change_me$|your[-_])/i.test(secret)
    ) {
      throw new Error('JWT_SECRET must be set to your own secret');
    }
    if (production && Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error(
        'JWT_SECRET must contain at least 32 bytes in production',
      );
    }
  }
  const database = validateUrl(
    raw.DATABASE_URL,
    'DATABASE_URL',
    ['mysql:'],
    production,
  );
  if (database && database.pathname.length <= 1) {
    throw new Error('DATABASE_URL must select a database');
  }
  if (production && database) {
    let password: string;
    try {
      password = decodeURIComponent(database.password);
    } catch {
      throw new Error('DATABASE_URL credentials must be URL-encoded');
    }
    if (
      !database.username ||
      !password ||
      ['change_me', 'password', 'replace_me'].includes(password.toLowerCase())
    ) {
      throw new Error(
        'DATABASE_URL must use non-placeholder database credentials in production',
      );
    }
  }
  const redis = validateUrl(
    raw.REDIS_URL,
    'REDIS_URL',
    ['redis:', 'rediss:'],
    production,
  );
  if (production && redis) {
    let password: string;
    try {
      password = decodeURIComponent(redis.password);
    } catch {
      throw new Error('REDIS_URL credentials must be URL-encoded');
    }
    if (
      !password ||
      ['change_me', 'password', 'replace_me'].includes(password.toLowerCase())
    ) {
      throw new Error(
        'REDIS_URL must use non-placeholder credentials in production',
      );
    }
  }
  const storage = raw.RATE_LIMIT_STORAGE ?? (production ? 'redis' : 'memory');
  if (
    typeof storage !== 'string' ||
    !['memory', 'redis'].includes(storage) ||
    (production && storage !== 'redis')
  ) {
    throw new Error(
      'RATE_LIMIT_STORAGE must be memory or redis; production requires redis',
    );
  }
  const prefix = raw.RATE_LIMIT_PREFIX ?? `hotel-booking:${nodeEnv}:rate-limit`;
  if (typeof prefix !== 'string' || !/^[a-zA-Z0-9:_-]{1,100}$/.test(prefix)) {
    throw new Error(
      'RATE_LIMIT_PREFIX must contain 1-100 letters, digits, colons, underscores or hyphens',
    );
  }
  const trustProxy = raw.TRUST_PROXY ?? 'false';
  parseTrustProxy(trustProxy);
  return {
    ...raw,
    NODE_ENV: nodeEnv,
    PORT: integer(raw.PORT, 3000, 'PORT', 65535),
    JWT_EXPIRES_IN: integer(raw.JWT_EXPIRES_IN, 900, 'JWT_EXPIRES_IN'),
    RATE_LIMIT_STORAGE: storage,
    RATE_LIMIT_PREFIX: prefix,
    TRUST_PROXY: trustProxy,
  };
}
