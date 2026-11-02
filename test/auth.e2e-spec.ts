import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import request from 'supertest';
import type { Response } from 'supertest';
import type { AuthService } from '../src/auth/auth.service';
import type { ApiErrorResponse } from '../src/common/types/api-error';
import type { User } from '../src/users/types/user';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { TokenModule } from '../src/auth/token.module';

type LoginResponse = { data: Awaited<ReturnType<AuthService['login']>> };
type ProfileResponse = { data: Omit<User, 'passwordHash'> };

// Supertest's body is any; describe the expected JSON shape at the test boundary.
function responseBody<T>(response: Response): T {
  return JSON.parse(response.text) as T;
}

@Controller('test-admin')
class TestAdminController {
  @Get('failure')
  fail() {
    throw new Error('internal SQL password=do-not-expose');
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  checkAdmin() {
    return { allowed: true };
  }
}

describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: UsersService;
  let prisma: PrismaService;
  const runId = randomUUID();
  const testEmails = new Set<string>();
  const testEmail = (label: string) => {
    const email = `${label}-${runId}@example.com`;
    testEmails.add(email);
    return email;
  };

  async function startApp() {
    const module = await Test.createTestingModule({
      imports: [AppModule, TokenModule],
      controllers: [TestAdminController],
    }).compile();
    usersService = module.get(UsersService);
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  }

  beforeAll(startApp);

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.user.deleteMany({
          where: { email: { in: [...testEmails] } },
        });
      }
    } finally {
      await app?.close();
    }
  });

  it('registers, logs in and accepts the issued token for the same user', async () => {
    const credentials = {
      email: testEmail('auth-flow'),
      password: 'TestPassword123!',
    };
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Auth Test', ...credentials })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(200);
    const { accessToken, user } = responseBody<LoginResponse>(login).data;
    expect(user.role).toBe('USER');
    expect(typeof accessToken).toBe('string');

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(responseBody<ProfileResponse>(me).data.id).toBe(user.id);
    expect(responseBody<ProfileResponse>(me).data.email).toBe(
      credentials.email,
    );
    expect(responseBody<ProfileResponse>(me).data).not.toHaveProperty(
      'passwordHash',
    );
    expect(responseBody<ProfileResponse>(me).data).not.toHaveProperty(
      'password',
    );

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Basic ${accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/test-admin')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('allows ADMIN to access the admin route', async () => {
    const password = 'AdminTestPassword123!';
    const now = new Date();

    await usersService.create({
      id: randomUUID(),
      name: 'Test Admin',
      email: testEmail('admin-test'),
      passwordHash: await argon2.hash(password),
      role: 'ADMIN',
      createdAt: now,
      updatedAt: now,
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail('admin-test'), password })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/test-admin')
      .set(
        'Authorization',
        `Bearer ${responseBody<LoginResponse>(login).data.accessToken}`,
      )
      .expect(200)
      .expect({ allowed: true });
  });

  it('rejects admin access without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/test-admin').expect(401);
  });

  it('rejects missing and invalid tokens', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('assigns a distinct request ID even when authentication fails', async () => {
    const first = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .expect(401);
    const second = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .expect(401);

    expect(first.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second.headers['x-request-id']).toBeDefined();
    expect(second.headers['x-request-id']).not.toBe(
      first.headers['x-request-id'],
    );
    expect(responseBody<ApiErrorResponse>(first)).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: expect.any(String) as unknown,
        details: [],
      },
      requestId: String(first.headers['x-request-id']),
    });
  });

  it('returns field details and rejects attempts to choose an admin role', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: 'invalid', password: '123', role: 'ADMIN' })
      .expect(400);

    expect(responseBody<ApiErrorResponse>(result).error.code).toBe(
      'VALIDATION_ERROR',
    );
    expect(responseBody<ApiErrorResponse>(result).error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'email',
          message: expect.any(String) as unknown,
        }),
        expect.objectContaining({
          field: 'password',
          message: expect.any(String) as unknown,
        }),
        expect.objectContaining({
          field: 'role',
          message: expect.any(String) as unknown,
        }),
      ]),
    );
    expect(responseBody<ApiErrorResponse>(result).requestId).toBe(
      result.headers['x-request-id'],
    );
  });

  it('returns specific duplicate-email and invalid-credentials codes', async () => {
    const credentials = {
      email: testEmail('error-test'),
      password: 'Password123!',
    };
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Error Test', ...credentials })
      .expect(201);
    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Error Test', ...credentials })
      .expect(409);
    expect(responseBody<ApiErrorResponse>(duplicate).error.code).toBe(
      'EMAIL_ALREADY_EXISTS',
    );

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ ...credentials, password: 'WrongPassword123!' })
      .expect(401);
    const missingUser = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ ...credentials, email: testEmail('missing-user') })
      .expect(401);
    expect(responseBody<ApiErrorResponse>(wrongPassword).error.code).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(responseBody<ApiErrorResponse>(missingUser).error).toEqual(
      responseBody<ApiErrorResponse>(wrongPassword).error,
    );
  });

  it('hides internal errors and formats unknown routes and malformed JSON', async () => {
    const failure = await request(app.getHttpServer())
      .get('/api/v1/test-admin/failure')
      .expect(500);
    expect(responseBody<ApiErrorResponse>(failure).error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: [],
    });
    expect(responseBody<ApiErrorResponse>(failure).requestId).toBe(
      failure.headers['x-request-id'],
    );

    const missing = await request(app.getHttpServer())
      .get('/api/v1/not-a-route')
      .expect(404);
    expect(responseBody<ApiErrorResponse>(missing).error.code).toBe(
      'RESOURCE_NOT_FOUND',
    );

    const malformed = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"password":')
      .expect(400);
    expect(responseBody<ApiErrorResponse>(malformed).error.code).toBe(
      'VALIDATION_ERROR',
    );
    expect(responseBody<ApiErrorResponse>(malformed).requestId).toBe(
      malformed.headers['x-request-id'],
    );
  });

  it('keeps the registered user after the application is closed and recreated', async () => {
    const credentials = {
      email: testEmail('persistent'),
      password: 'PersistentPassword123!',
    };
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Persistent User', ...credentials })
      .expect(201);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: credentials.email },
    });
    expect(stored.passwordHash).not.toBe(credentials.password);
    expect(await argon2.verify(stored.passwordHash, credentials.password)).toBe(
      true,
    );

    await app.close();
    await startApp();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(200);
    const profile = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set(
        'Authorization',
        `Bearer ${responseBody<LoginResponse>(login).data.accessToken}`,
      )
      .expect(200);
    expect(responseBody<ProfileResponse>(profile).data.id).toBe(stored.id);
    expect(responseBody<ProfileResponse>(profile).data).not.toHaveProperty(
      'passwordHash',
    );
  });

  it('allows only one simultaneous registration for the same email', async () => {
    const input = {
      name: 'Concurrent User',
      email: testEmail('concurrent'),
      password: 'ConcurrentPassword123!',
    };
    const responses = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/auth/register').send(input),
      request(app.getHttpServer()).post('/api/v1/auth/register').send(input),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responseBody<ApiErrorResponse>(
        responses.find((response) => response.status === 409)!,
      ).error.code,
    ).toBe('EMAIL_ALREADY_EXISTS');
    expect(await prisma.user.count({ where: { email: input.email } })).toBe(1);
  });

  it('maps the database unique constraint to the API duplicate-email error', async () => {
    const now = new Date();
    const user = {
      id: randomUUID(),
      name: 'Constraint Test',
      email: testEmail('constraint'),
      passwordHash: await argon2.hash('ConstraintPassword123!'),
      role: 'USER' as const,
      createdAt: now,
      updatedAt: now,
    };
    await usersService.create(user);
    await expect(
      usersService.create({ ...user, id: randomUUID() }),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'EMAIL_ALREADY_EXISTS',
      }) as unknown,
    });
  });
});
