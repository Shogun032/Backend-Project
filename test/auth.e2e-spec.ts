import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { UsersService } from '../src/users/users.service';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { TokenModule } from '../src/auth/token.module';

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

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule, TokenModule],
      controllers: [TestAdminController],
    }).compile();
    usersService = module.get(UsersService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers, logs in and accepts the issued token for the same user', async () => {
    const credentials = {
      email: 'auth-flow@example.com',
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
    const { accessToken, user } = login.body.data;
    expect(user.role).toBe('USER');
    expect(typeof accessToken).toBe('string');

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.data.id).toBe(user.id);
    expect(me.body.data.email).toBe(credentials.email);
    expect(me.body.data).not.toHaveProperty('passwordHash');
    expect(me.body.data).not.toHaveProperty('password');

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

    usersService.create({
      id: randomUUID(),
      name: 'Test Admin',
      email: 'admin-test@example.com',
      passwordHash: await argon2.hash(password),
      role: 'ADMIN',
      createdAt: now,
      updatedAt: now,
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin-test@example.com', password })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/test-admin')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
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
    expect(first.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: expect.any(String),
        details: [],
      },
      requestId: first.headers['x-request-id'],
    });
  });

  it('returns field details and rejects attempts to choose an admin role', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: 'invalid', password: '123', role: 'ADMIN' })
      .expect(400);

    expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(result.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'email',
          message: expect.any(String),
        }),
        expect.objectContaining({
          field: 'password',
          message: expect.any(String),
        }),
        expect.objectContaining({ field: 'role', message: expect.any(String) }),
      ]),
    );
    expect(result.body.requestId).toBe(result.headers['x-request-id']);
  });

  it('returns specific duplicate-email and invalid-credentials codes', async () => {
    const credentials = {
      email: 'error-test@example.com',
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
    expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_EXISTS');

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ ...credentials, password: 'WrongPassword123!' })
      .expect(401);
    const missingUser = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ ...credentials, email: 'missing-user@example.com' })
      .expect(401);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(missingUser.body.error).toEqual(wrongPassword.body.error);
  });

  it('hides internal errors and formats unknown routes and malformed JSON', async () => {
    const failure = await request(app.getHttpServer())
      .get('/api/v1/test-admin/failure')
      .expect(500);
    expect(failure.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: [],
    });
    expect(failure.body.requestId).toBe(failure.headers['x-request-id']);

    const missing = await request(app.getHttpServer())
      .get('/api/v1/not-a-route')
      .expect(404);
    expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const malformed = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"password":')
      .expect(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
    expect(malformed.body.requestId).toBe(malformed.headers['x-request-id']);
  });
});
