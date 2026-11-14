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
import { bangkokToday } from '../src/bookings/booking-rules';

interface BookingResult {
  id: string;
  userId: string;
  roomId: string;
  status: string;
  checkIn: string;
  checkOut: string;
  pricePerNight: string;
  totalPrice: string;
}
interface NotificationResult {
  id: string;
  bookingId: string;
  userId: string;
  type: string;
}
interface Envelope<T> {
  data: T;
  meta: { page: number; limit: number; total: number; totalPages: number };
}
function body<T>(response: Response): T {
  return JSON.parse(response.text) as T;
}
function stay(offset = 10) {
  const start = new Date(`${bangkokToday()}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + offset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 2);
  return {
    checkIn: start.toISOString().slice(0, 10),
    checkOut: end.toISOString().slice(0, 10),
  };
}

describe('Bookings integration with Auth and MySQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const roomIds: string[] = [];
  let ownerToken: string;
  let otherToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    prisma = module.get(PrismaService);
    await app.init();
    const password = 'BookingTestPassword123!';
    const passwordHash = await argon2.hash(password);
    const tokens: string[] = [];
    for (const role of ['USER', 'USER', 'ADMIN'] as const) {
      const user = await prisma.user.create({
        data: {
          name: 'Booking integration',
          email: `${randomUUID()}@example.com`,
          role,
          passwordHash,
        },
      });
      userIds.push(user.id);
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password })
        .expect(200);
      tokens.push(
        body<{ data: { accessToken: string } }>(login).data.accessToken,
      );
    }
    [ownerToken, otherToken, adminToken] = tokens;
  });

  beforeEach(() => {
    resetRateLimits(app);
  });

  afterAll(async () => {
    try {
      if (prisma && userIds.length) {
        await prisma.notification.deleteMany({
          where: { booking: { userId: { in: userIds } } },
        });
        await prisma.booking.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
  });

  async function room(isActive = true) {
    const result = await prisma.room.create({
      data: {
        name: `Test ${randomUUID()}`,
        capacity: 2,
        pricePerNight: '1500.00',
        isActive,
      },
    });
    roomIds.push(result.id);
    return result;
  }

  async function create(roomId: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roomId, ...stay(), guests: 2 })
      .expect(201);
    return body<Envelope<BookingResult>>(response).data;
  }

  it('serializes simultaneous creates, allows adjacent stays, and preserves price snapshots', async () => {
    const target = await room();
    const input = { roomId: target.id, ...stay(), guests: 2 };
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send(input),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const created = body<Envelope<BookingResult>>(
      responses.find((response) => response.status === 201)!,
    ).data;
    expect(created.checkIn).toBe(input.checkIn);
    expect(created.checkOut).toBe(input.checkOut);
    expect(created.totalPrice).toBe('3000.00');
    expect(await prisma.booking.count({ where: { roomId: target.id } })).toBe(
      1,
    );
    expect(
      await prisma.notification.count({ where: { bookingId: created.id } }),
    ).toBe(1);
    const adjacent = stay(12);
    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...input, ...adjacent })
      .expect(201);
    await prisma.room.update({
      where: { id: target.id },
      data: { pricePerNight: '1800.00' },
    });
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${created.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(body<Envelope<BookingResult>>(detail).data.pricePerNight).toBe(
      '1500.00',
    );
  });

  it('enforces ownership and ADMIN roles, and validates UUID/query/body inputs', async () => {
    const target = await room();
    const booking = await create(target.id);
    await request(app.getHttpServer())
      .get(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${booking.id}/status`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'CANCELLED' })
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/admin/bookings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/bookings/not-a-uuid')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/bookings?limit=101')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roomId: target.id, ...stay(20), guests: 2, userId: userIds[1] })
      .expect(400);
    await request(app.getHttpServer()).get('/api/v1/bookings').expect(401);
  });

  it('cancels once under simultaneous requests and reports owner notifications with pagination', async () => {
    const target = await room();
    const booking = await create(target.id);
    const responses = await Promise.all(
      [ownerToken, adminToken].map((token) =>
        request(app.getHttpServer())
          .patch(
            `/api/v1/${token === adminToken ? 'admin/' : ''}bookings/${booking.id}/status`,
          )
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'CANCELLED' }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      await prisma.notification.count({
        where: { bookingId: booking.id, type: 'BOOKING_CANCELLED' },
      }),
    ).toBe(1);
    await create(target.id); // Cancelled stays release the room.
    const notifications = await request(app.getHttpServer())
      .get('/api/v1/notifications?limit=1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const result = body<Envelope<NotificationResult[]>>(notifications);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].userId).toBe(userIds[0]);
    expect(result.data[0]).not.toHaveProperty('isRead');
    expect(result.meta.limit).toBe(1);
    expect(result.meta.total).toBeGreaterThanOrEqual(2);
    const other = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(body<Envelope<NotificationResult[]>>(other).meta.total).toBe(0);
  });

  it('allows approval/payment only by the deadline and emits no notification for those transitions', async () => {
    const target = await room();
    const booking = await create(target.id);
    for (const status of ['APPROVED', 'PAID']) {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/bookings/${booking.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status })
        .expect(200);
    }
    expect(
      await prisma.notification.count({ where: { bookingId: booking.id } }),
    ).toBe(1);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/bookings/${booking.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CANCELLED' })
      .expect(409);
    const past = await prisma.booking.create({
      data: {
        userId: userIds[0],
        roomId: target.id,
        checkIn: new Date('2000-01-01'),
        checkOut: new Date('2000-01-03'),
        guests: 1,
        nights: 2,
        pricePerNight: '1500.00',
        totalPrice: '3000.00',
      },
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/bookings/${past.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(409);
    const lists = await request(app.getHttpServer())
      .get(`/api/v1/admin/bookings?roomId=${target.id}&status=PAID&limit=1`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const result = body<Envelope<BookingResult[]>>(lists);
    expect(result.meta.total).toBe(1);
    expect(result.data[0].id).toBe(booking.id);
  });

  it('rejects inactive rooms, excessive guests and invalid dates without partial writes', async () => {
    const target = await room(false);
    const input = { roomId: target.id, ...stay(), guests: 2 };
    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(input)
      .expect(409);
    await prisma.room.update({
      where: { id: target.id },
      data: { isActive: true },
    });
    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...input, guests: 3 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...input, checkIn: '2027-02-30' })
      .expect(400);
    expect(await prisma.booking.count({ where: { roomId: target.id } })).toBe(
      0,
    );
    expect(
      await prisma.notification.count({
        where: { booking: { roomId: target.id } },
      }),
    ).toBe(0);
  });

  it('protects every Admin Booking endpoint', async () => {
    const id = randomUUID();

    const routes = [
      ['get', '/api/v1/admin/bookings'],
      ['get', `/api/v1/admin/bookings/${id}`],
      ['patch', `/api/v1/admin/bookings/${id}/status`],
    ] as const;

    for (const [method, path] of routes) {
      // ไม่มี Token ต้องเข้าไม่ได้
      await request(app.getHttpServer())[method](path).expect(401);

      // มี Token แต่เป็น User ต้องเข้าไม่ได้
      await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);
    }
  });
});
