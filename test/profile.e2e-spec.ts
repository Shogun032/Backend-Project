import { resetRateLimits } from './helpers/reset-rate-limits';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { ApiErrorResponse } from '../src/common/types/api-error';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
}
function body<T>(response: Response): T {
  return JSON.parse(response.text) as T;
}

describe('Profile updates (MySQL e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const users: Profile[] = [];
  const tokens: string[] = [];
  const password = 'ProfileTestPassword123!';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    prisma = module.get(PrismaService);
    await app.init();
    const passwordHash = await argon2.hash(password);
    for (let i = 0; i < 4; i++) {
      const user = await prisma.user.create({
        data: {
          name: 'Profile Test',
          email: `profile-${randomUUID()}@example.com`,
          passwordHash,
        },
      });
      users.push(user);
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password })
        .expect(200);
      tokens.push(
        body<{ data: { accessToken: string } }>(login).data.accessToken,
      );
    }
  });

  beforeEach(() => {
    resetRateLimits(app);
  });

  afterAll(async () => {
    try {
      if (prisma && users.length) {
        await prisma.user.deleteMany({
          where: { id: { in: users.map((user) => user.id) } },
        });
      }
    } finally {
      await app?.close();
    }
  });

  function update(payload: object, index = 0) {
    return request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokens[index]}`)
      .send(payload);
  }

  it.each([
    ['empty body', {}],
    ['blank name', { name: '   ' }],
    ['invalid email', { email: 'not-email' }],
    ['null name', { name: null }],
    ['null email', { email: null }],
    ['numeric name', { name: 123 }],
    ['name too long', { name: 'a'.repeat(101) }],
    ['role change', { role: 'ADMIN' }],
    ['password change', { password: 'NewPassword123!' }],
    ['client userId', { userId: 'someone-else', name: 'Changed' }],
    ['client id', { id: 'someone-else', name: 'Changed' }],
  ])('rejects %s without changing the account', async (_label, payload) => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: users[0].id },
    });
    const response = await update(payload).expect(400);
    const result = body<ApiErrorResponse>(response);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(result.error.details)).toBe(true);
    expect(result.requestId).toBe(response.headers['x-request-id']);
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: users[0].id },
    });
    expect(after).toEqual(before);
  });

  it('requires a valid token', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .send({ name: 'Changed' })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', 'Bearer invalid-token')
      .send({ name: 'Changed' })
      .expect(401);
  });

  it('updates only the authenticated user, trims the name and excludes password fields', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: users[0].id },
    });
    const response = await update({ name: '  Updated Name  ' }).expect(200);
    const profile = body<{ data: Profile }>(response).data;
    expect(profile.id).toBe(users[0].id);
    expect(profile.name).toBe('Updated Name');
    expect(profile.email).toBe(before.email);
    expect(profile.role).toBe('USER');
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('password');
    const saved = await prisma.user.findUniqueOrThrow({
      where: { id: users[0].id },
    });
    expect(saved.passwordHash).toBe(before.passwordHash);
    const other = await prisma.user.findUniqueOrThrow({
      where: { id: users[1].id },
    });
    expect(other.name).toBe('Profile Test');
  });

  it('normalizes a new email, keeps the password, and allows login only with the new email', async () => {
    const email = `updated-${randomUUID()}@example.com`;
    const response = await update({
      email: `  ${email.toUpperCase()}  `,
    }).expect(200);
    expect(body<{ data: Profile }>(response).data.email).toBe(email);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: users[0].email, password })
      .expect(401);
    await update({ email }).expect(200); // Keeping your own email is allowed.
    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokens[0]}`)
      .expect(200);
    expect(body<{ data: Profile }>(me).data.email).toBe(email);
  });

  it('returns 409 for an email owned by someone else and rolls back the name change too', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: users[0].id },
    });
    const response = await update({
      name: 'Must not persist',
      email: users[1].email,
    }).expect(409);
    expect(body<ApiErrorResponse>(response).error.code).toBe(
      'EMAIL_ALREADY_EXISTS',
    );
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } }),
    ).toEqual(before);
  });

  it('allows only one concurrent update to claim the same email', async () => {
    const email = `concurrent-profile-${randomUUID()}@example.com`;
    const responses = await Promise.all([
      update({ email }, 2),
      update({ email }, 3),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    const conflict = responses.find((response) => response.status === 409)!;
    expect(body<ApiErrorResponse>(conflict).error.code).toBe(
      'EMAIL_ALREADY_EXISTS',
    );
  });

  it('returns 404 when the token owner has been deleted', async () => {
    await prisma.user.delete({ where: { id: users[3].id } });
    const response = await update({ name: 'Deleted account' }, 3).expect(404);
    expect(body<ApiErrorResponse>(response).error.code).toBe(
      'RESOURCE_NOT_FOUND',
    );
  });
});
