import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from 'redis';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { RedisThrottlerStorage } from '../src/common/rate-limit/redis-throttler.storage';
import { configureHttp } from '../src/config/http.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Shared Redis rate limiting across API instances', () => {
  const apps = new Set<NestExpressApplication>();
  const prefixes = new Set<string>();
  const input = {
    email: 'rate-redis@example.com',
    password: 'WrongPassword123!',
  };
  let redis: ReturnType<typeof createClient>;

  beforeAll(async () => {
    redis = createClient({
      url: process.env.TEST_REDIS_URL,
      disableOfflineQueue: true,
    });
    redis.on('error', jest.fn());
    await redis.connect();
  });

  afterEach(async () => {
    for (const app of apps) await app.close();
    apps.clear();
    for (const prefix of prefixes) {
      for await (const keys of redis.scanIterator({
        MATCH: `${prefix}:*`,
        COUNT: 100,
      })) {
        if (keys.length) await redis.del(keys);
      }
    }
    prefixes.clear();
  });

  afterAll(async () => {
    if (redis?.isOpen) await redis.close();
  });

  function prefix() {
    const value = `e2e:rate:${randomUUID()}`;
    prefixes.add(value);
    return value;
  }

  async function start(ratePrefix: string, trust = 'false') {
    const config = new ConfigService({
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: 900,
      REDIS_URL: process.env.TEST_REDIS_URL,
      RATE_LIMIT_STORAGE: 'redis',
      RATE_LIMIT_PREFIX: ratePrefix,
      TRUST_PROXY: trust,
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AuthService)
      .useValue({
        login: jest
          .fn()
          .mockRejectedValue(
            new UnauthorizedException('Invalid email or password'),
          ),
      })
      .compile();
    const app = module.createNestApplication<NestExpressApplication>();
    apps.add(app);
    configureHttp(app, config);
    await app.init();
    return app;
  }

  function login(app: NestExpressApplication) {
    return request(app.getHttpServer()).post('/api/v1/auth/login').send(input);
  }

  it('shares one atomic quota under concurrent requests and keeps it after one app restarts', async () => {
    const ratePrefix = prefix();
    const first = await start(ratePrefix);
    const second = await start(ratePrefix);
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        login(index % 2 ? first : second),
      ),
    );
    expect(
      responses.filter((response) => response.status === 401),
    ).toHaveLength(5);
    expect(
      responses.filter((response) => response.status === 429),
    ).toHaveLength(7);
    const blocked = responses.find((response) => response.status === 429)!;
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    await first.close();
    apps.delete(first);
    const restarted = await start(ratePrefix);
    await login(restarted).expect(429);
  });

  it('returns 503 rather than allowing requests when its Redis connection is unavailable', async () => {
    const app = await start(prefix());
    await app.get(RedisService).onModuleDestroy();
    const response = await login(app).expect(503);
    expect(JSON.parse(response.text) as unknown).toMatchObject({
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
    expect(response.text).not.toContain(process.env.TEST_REDIS_URL);
  });

  it('does not let forged forwarded headers reset the quota when no proxy is trusted', async () => {
    const app = await start(prefix());
    for (let i = 0; i < 5; i++) {
      await login(app)
        .set('X-Forwarded-For', `203.0.113.${i + 1}`)
        .expect(401);
    }
    await login(app).set('X-Forwarded-For', '198.51.100.99').expect(429);
  });

  it('separates real forwarded clients and ignores spoofed leftmost entries behind a trusted proxy', async () => {
    const app = await start(prefix(), 'loopback');
    for (let i = 0; i < 5; i++) {
      await login(app)
        .set('X-Forwarded-For', `198.51.100.${i + 1}, 203.0.113.10`)
        .expect(401);
    }
    await login(app)
      .set('X-Forwarded-For', '198.51.100.99, 203.0.113.10')
      .expect(429);
    await login(app).set('X-Forwarded-For', '203.0.113.11').expect(401);
  });

  it('expires a Redis block so requests can resume without flushing Redis', async () => {
    const app = await start(prefix());
    const storage = new RedisThrottlerStorage(app.get(RedisService), prefix());
    let complete = await storage.increment('expiry', 5_000, 1, 200, 'default');
    expect(complete.isBlocked).toBe(false);
    complete = await storage.increment('expiry', 5_000, 1, 200, 'default');
    expect(complete.isBlocked).toBe(true);
    await delay(350);
    complete = await storage.increment('expiry', 5_000, 1, 200, 'default');
    expect(complete.isBlocked).toBe(false);
    expect(complete.totalHits).toBe(1);
  });
});
