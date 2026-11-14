import { resetRateLimits } from './helpers/reset-rate-limits';
import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { createClient } from 'redis';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import type { JwtPayload } from '../src/auth/types/jwt-payload';
import type { ApiErrorResponse } from '../src/common/types/api-error';

function body<T>(response: Response): T {
  return JSON.parse(response.text) as T;
}

describe('Logout with real MySQL and Redis', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let redisService: RedisService;
  let redis: ReturnType<typeof createClient>;
  let userId: string;
  const email = `logout-${randomUUID()}@example.com`;
  const password = 'LogoutTestPassword123!';
  const keys = new Set<string>();

  async function startApp() {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
    redisService = module.get(RedisService);
    await app.init();
  }

  beforeAll(async () => {
    await startApp();
    redis = createClient({
      url: process.env.TEST_REDIS_URL,
      disableOfflineQueue: true,
    });
    redis.on('error', jest.fn());
    await redis.connect();
    const user = await prisma.user.create({
      data: {
        name: 'Logout Test',
        email,
        passwordHash: await argon2.hash(password),
      },
    });
    userId = user.id;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    resetRateLimits(app);
  });

  afterAll(async () => {
    try {
      if (userId && prisma)
        await prisma.user.deleteMany({ where: { id: userId } });
      if (redis?.isReady && keys.size) await redis.del([...keys]);
    } finally {
      await app?.close();
      if (redis?.isOpen) await redis.close();
    }
  });

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const token = body<{ data: { accessToken: string } }>(response).data
      .accessToken;
    const payload = jwt.decode<JwtPayload>(token);
    keys.add(`auth:revoked:${payload.jti}`);
    return { token, payload };
  }

  it('returns 204 without a body and rejects the old token on protected APIs', async () => {
    const { token, payload } = await login();
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    expect(logout.text).toBe('');
    expect(await redis.get(`auth:revoked:${payload.jti}`)).toBe('1');
    for (const route of ['users/me', 'bookings', 'notifications']) {
      const result = await request(app.getHttpServer())
        .get(`/api/v1/${route}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(body<ApiErrorResponse>(result).error.code).toBe('UNAUTHORIZED');
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    const fresh = await login();
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${fresh.token}`)
      .expect(200);
  });

  it('revokes only the submitted token, not other login sessions', async () => {
    const first = await login();
    const second = await login();
    expect(first.payload.jti).not.toBe(second.payload.jti);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${first.token}`)
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${second.token}`)
      .expect(200);
  });

  it('sets expiration exactly to JWT exp and discards already-expired entries', async () => {
    const { token, payload } = await login();
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    expect(await redis.expireTime(`auth:revoked:${payload.jti}`)).toBe(
      payload.exp,
    );
    const expiredId = randomUUID();
    keys.add(`auth:revoked:${expiredId}`);
    await redisService.revokeToken(
      expiredId,
      Math.floor(Date.now() / 1000) - 1,
    );
    expect(await redis.exists(`auth:revoked:${expiredId}`)).toBe(0);
  });

  it('rejects missing, malformed and expired tokens', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
    const token = await jwt.signAsync(
      { sub: userId, role: 'USER', jti: randomUUID() },
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('preserves 503 when the revocation check fails', async () => {
    const { token } = await login();
    jest
      .spyOn(redisService, 'isTokenRevoked')
      .mockRejectedValue(new ServiceUnavailableException());
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(503);
    expect(body<ApiErrorResponse>(response).error.code).toBe(
      'SERVICE_UNAVAILABLE',
    );
  });

  it('does not report successful logout when Redis cannot save the revocation', async () => {
    const { token, payload } = await login();
    const spy = jest
      .spyOn(redisService, 'revokeToken')
      .mockRejectedValue(new ServiceUnavailableException());
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(503);
    expect(body<ApiErrorResponse>(response).error.code).toBe(
      'SERVICE_UNAVAILABLE',
    );
    expect(await redis.exists(`auth:revoked:${payload.jti}`)).toBe(0);
    spy.mockRestore();
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('still rejects the revoked token after the API app is recreated', async () => {
    const { token } = await login();
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await app.close();
    await startApp();
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });
});
