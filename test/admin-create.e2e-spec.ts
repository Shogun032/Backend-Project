import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Local Admin creation command', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emails: string[] = [];
  const password = 'AdminCommandTest123!';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    try {
      if (prisma)
        await prisma.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await app?.close();
    }
  });

  function runAdmin(overrides: Record<string, string> = {}) {
    const email = `admin-command-${randomUUID()}@example.com`;
    const env = {
      ...process.env,
      ADMIN_NAME: 'Command Test',
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD: password,
      ...overrides,
    };
    emails.push(env.ADMIN_EMAIL.trim().toLowerCase());
    return {
      email: env.ADMIN_EMAIL.trim().toLowerCase(),
      process: spawnSync(
        process.execPath,
        [
          '--env-file=.env',
          '-r',
          'ts-node/register',
          'scripts/create-admin.ts',
        ],
        {
          cwd: process.cwd(),
          env,
          encoding: 'utf8',
          timeout: 15_000,
        },
      ),
    };
  }

  it('creates an ADMIN that can log in, and refuses to overwrite it on a second run', async () => {
    const created = runAdmin();
    expect(created.process.status).toBe(0);
    expect(created.process.stdout).toContain('Admin created successfully');
    expect(created.process.stdout + created.process.stderr).not.toContain(
      password,
    );
    const saved = await prisma.user.findUniqueOrThrow({
      where: { email: created.email },
    });
    expect(saved.role).toBe('ADMIN');
    expect(await argon2.verify(saved.passwordHash, password)).toBe(true);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: created.email, password })
      .expect(200);
    const result = JSON.parse(login.text) as { data: { accessToken: string } };
    await request(app.getHttpServer())
      .get('/api/v1/admin/bookings')
      .set('Authorization', `Bearer ${result.data.accessToken}`)
      .expect(200);
    const duplicate = runAdmin({
      ADMIN_EMAIL: created.email,
      ADMIN_PASSWORD: 'DifferentTestPassword123!',
    });
    expect(duplicate.process.status).toBe(1);
    expect(duplicate.process.stderr).toContain('No account was changed');
    expect(
      await prisma.user.findUniqueOrThrow({ where: { email: created.email } }),
    ).toEqual(saved);
  }, 30_000);

  it('does not promote an existing USER or change their password', async () => {
    const email = `existing-user-${randomUUID()}@example.com`;
    emails.push(email);
    const existing = await prisma.user.create({
      data: {
        name: 'Existing user',
        email,
        passwordHash: await argon2.hash(password),
      },
    });
    const result = runAdmin({ ADMIN_EMAIL: email });
    expect(result.process.status).toBe(1);
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: existing.id } }),
    ).toEqual(existing);
  }, 30_000);

  it.each([
    ['ADMIN_NAME', ''],
    ['ADMIN_EMAIL', 'not-an-email'],
    ['ADMIN_PASSWORD', 'short'],
    ['ADMIN_PASSWORD', 'x'.repeat(129)],
  ])(
    'rejects invalid %s without creating an account',
    async (field, value) => {
      const result = runAdmin({ [field]: value });
      expect(result.process.status).toBe(1);
      expect(result.process.stderr).toContain(field);
      if (field === 'ADMIN_PASSWORD' && value)
        expect(result.process.stderr).not.toContain(value);
      expect(await prisma.user.count({ where: { email: result.email } })).toBe(
        0,
      );
    },
    30_000,
  );
});
