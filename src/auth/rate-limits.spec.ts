import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';

describe('Login rate limiting', () => {
  let app: INestApplication<App>;

  const login = jest
    .fn()
    .mockRejectedValue(new UnauthorizedException('Invalid email or password'));

  beforeAll(async () => {
    const config: Record<string, string> = {
      JWT_SECRET: 'rate-limit-test-secret-only',
      JWT_EXPIRES_IN: '900',
      RATE_LIMIT_STORAGE: 'memory',
    };

    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string, fallback: unknown) => config[key] ?? fallback,
        getOrThrow: (key: string) => {
          if (config[key] === undefined) {
            throw new Error(`Missing test config: ${key}`);
          }
          return config[key];
        },
      })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(RedisService)
      .useValue({})
      .overrideProvider(AuthService)
      .useValue({ login })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('allows 5 attempts and blocks the sixth before calling AuthService', async () => {
    const input = {
      email: 'rate-limit@example.com',
      password: 'WrongPassword123!',
    };

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(input)
        .expect(401);
    }

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(input)
      .expect(429);

    const body = JSON.parse(response.text) as {
      error: { code: string };
    };

    expect(body.error.code).toBe('RATE_LIMITED');
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(login).toHaveBeenCalledTimes(5);
  });

  it('blocks the eleventh booking attempt', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send({})
        .expect(401);
    }

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({})
      .expect(429);

    const body = JSON.parse(response.text) as {
      error: { code: string };
    };

    expect(body.error.code).toBe('RATE_LIMITED');
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  });
});
