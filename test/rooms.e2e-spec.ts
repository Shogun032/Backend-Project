import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { bangkokToday } from '../src/bookings/booking-rules';

interface Room {
  id: string;
  name: string;
  pricePerNight: string;
  currency: string;
  capacity: number;
  isActive: boolean;
  images: { url: string; altText: string; sortOrder: number }[];
}
interface Envelope<T> {
  data: T;
  meta: { page: number; limit: number; total: number; totalPages: number };
  error: { code: string };
}
function body<T>(response: Response): Envelope<T> {
  return JSON.parse(response.text) as Envelope<T>;
}
function stay() {
  const date = new Date(`${bangkokToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 30);
  const checkIn = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 2);
  return { checkIn, checkOut: date.toISOString().slice(0, 10) };
}

describe('Rooms integration with Auth, Bookings and MySQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  const userIds: string[] = [];
  const roomIds: string[] = [];
  const createdSeedIds: string[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    prisma = module.get(PrismaService);
    await app.init();
    const password = 'RoomsIntegration123!';
    const passwordHash = await argon2.hash(password);
    const tokens: string[] = [];
    for (const role of ['ADMIN', 'USER'] as const) {
      const user = await prisma.user.create({
        data: {
          name: 'Rooms test',
          email: `${randomUUID()}@example.com`,
          passwordHash,
          role,
        },
      });
      userIds.push(user.id);
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password })
        .expect(200);
      tokens.push(body<{ accessToken: string }>(login).data.accessToken);
    }
    [adminToken, userToken] = tokens;
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.notification.deleteMany({
          where: { booking: { userId: { in: userIds } } },
        });
        await prisma.booking.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.room.deleteMany({
          where: { id: { in: [...roomIds, ...createdSeedIds] } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
  });

  function auth(token = adminToken) {
    return `Bearer ${token}`;
  }
  const input = {
    name: 'Integration room',
    capacity: 4,
    pricePerNight: '1800.00',
    images: [
      { url: 'https://example.com/b.jpg', altText: 'B', sortOrder: 2 },
      { url: 'https://example.com/a.jpg', altText: 'A', sortOrder: 0 },
    ],
  };
  async function create(isActive = true) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set('Authorization', auth())
      .send({ ...input, isActive })
      .expect(201);
    const room = body<Room>(response).data;
    roomIds.push(room.id);
    expect(response.headers.location).toBe(`/api/v1/admin/rooms/${room.id}`);
    return room;
  }
  async function book(roomId: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', auth(userToken))
      .send({ roomId, ...stay(), guests: 4 })
      .expect(201);
    return body<{ id: string }>(response).data.id;
  }

  it('requires authentication and Admin role for every protected Rooms operation', async () => {
    const id = randomUUID();
    for (const [method, path] of [
      ['get', '/api/v1/admin/rooms'],
      ['get', `/api/v1/admin/rooms/${id}`],
      ['post', '/api/v1/rooms'],
      ['patch', `/api/v1/rooms/${id}`],
      ['delete', `/api/v1/rooms/${id}`],
    ] as const) {
      await request(app.getHttpServer())[method](path).expect(401);
      await request(app.getHttpServer())
        [method](path)
        .set('Authorization', auth(userToken))
        .expect(403);
    }
  });

  it('creates, reads, updates images and deletes a room, with decimal prices and no delete body', async () => {
    const room = await create();
    expect(room.pricePerNight).toBe('1800.00');
    expect(room.currency).toBe('THB');
    expect(room.images.map((image) => image.sortOrder)).toEqual([0, 2]);
    await request(app.getHttpServer())
      .get(`/api/v1/rooms/${room.id}`)
      .expect(200);
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/rooms/${room.id}`)
      .set('Authorization', auth())
      .send({
        name: 'Changed',
        images: [{ url: 'https://example.com/new.jpg' }],
      })
      .expect(200);
    expect(body<Room>(patch).data.images).toEqual([
      { url: 'https://example.com/new.jpg', altText: '', sortOrder: 0 },
    ]);
    await request(app.getHttpServer())
      .patch(`/api/v1/rooms/${room.id}`)
      .set('Authorization', auth())
      .send({ images: [] })
      .expect(200);
    expect(await prisma.roomImage.count({ where: { roomId: room.id } })).toBe(
      0,
    );
    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/rooms/${room.id}`)
      .set('Authorization', auth())
      .expect(204);
    expect(deleted.text).toBe('');
    await request(app.getHttpServer())
      .get(`/api/v1/rooms/${room.id}`)
      .expect(404);
  });

  it('hides inactive rooms publicly and parses the Admin false filter and pagination', async () => {
    const room = await create(false);
    await request(app.getHttpServer())
      .get(`/api/v1/rooms/${room.id}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/rooms/${room.id}`)
      .set('Authorization', auth())
      .expect(200);
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/rooms?isActive=false&page=1&limit=100')
      .set('Authorization', auth())
      .expect(200);
    expect(body<Room[]>(list).data.some((item) => item.id === room.id)).toBe(
      true,
    );
    expect(body<Room[]>(list).data.every((item) => !item.isActive)).toBe(true);
    const publicList = await request(app.getHttpServer())
      .get('/api/v1/rooms?page=1&limit=1')
      .expect(200);
    expect(body<Room[]>(publicList).data.every((item) => item.isActive)).toBe(
      true,
    );
    expect(body<Room[]>(publicList).meta).toMatchObject({ page: 1, limit: 1 });
  });

  it.each([
    { pricePerNight: '0.00' },
    { pricePerNight: 100 },
    { pricePerNight: '1.001' },
    { capacity: 0 },
    { name: '   ' },
    { isActive: null },
    { images: [{ url: 'http://example.com/insecure.jpg' }] },
    { unexpected: true },
  ])('rejects invalid create data %j', async (invalid) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set('Authorization', auth())
      .send({ ...input, ...invalid })
      .expect(400);
    expect(body<never>(response).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects empty/null PATCH fields and invalid dates, pagination and boolean filters', async () => {
    const room = await create();
    for (const patch of [{}, { name: null }, { images: null }]) {
      await request(app.getHttpServer())
        .patch(`/api/v1/rooms/${room.id}`)
        .set('Authorization', auth())
        .send(patch)
        .expect(400);
    }
    for (const query of [
      '?page=0',
      '?limit=101',
      '/search?checkIn=bad&checkOut=bad&guests=1',
      `/search?checkIn=${stay().checkOut}&checkOut=${stay().checkIn}&guests=1`,
    ])
      await request(app.getHttpServer())
        .get(`/api/v1/rooms${query}`)
        .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/admin/rooms?isActive=other')
      .set('Authorization', auth())
      .expect(400);
  });

  it('uses Booking availability rules, allows adjacent stays and releases cancelled bookings', async () => {
    const room = await create();
    const bookingId = await book(room.id);
    async function search(
      checkIn = stay().checkIn,
      checkOut = stay().checkOut,
      guests = 4,
    ) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/rooms/search')
        .query({ checkIn, checkOut, guests, limit: 100 })
        .expect(200);
      return body<Room[]>(response).data.some((item) => item.id === room.id);
    }
    expect(await search()).toBe(false);
    const end = new Date(`${stay().checkOut}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    expect(await search(stay().checkOut, end.toISOString().slice(0, 10))).toBe(
      true,
    );
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}/status`)
      .set('Authorization', auth(userToken))
      .send({ status: 'CANCELLED' })
      .expect(200);
    expect(await search()).toBe(true);
    expect(await search(undefined, undefined, 5)).toBe(false);
  });

  it('preserves rooms with booking history and prevents capacity reductions below booked guests', async () => {
    const room = await create();
    await book(room.id);
    const conflict = await request(app.getHttpServer())
      .patch(`/api/v1/rooms/${room.id}`)
      .set('Authorization', auth())
      .send({ capacity: 2 })
      .expect(409);
    expect(body<never>(conflict).error.code).toBe('ROOM_CAPACITY_CONFLICT');
    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/rooms/${room.id}`)
      .set('Authorization', auth())
      .expect(409);
    expect(body<never>(deleted).error.code).toBe('ROOM_HAS_BOOKINGS');
    await request(app.getHttpServer())
      .patch(`/api/v1/rooms/${room.id}`)
      .set('Authorization', auth())
      .send({ isActive: false })
      .expect(200);
  });

  it('can run the real seed twice without duplicating rooms/images or changing booking history', async () => {
    const ids = [101, 102, 103, 104, 105].map(
      (id) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    );
    const existing = await prisma.room.findMany({ where: { id: { in: ids } } });
    createdSeedIds.push(
      ...ids.filter((id) => !existing.some((room) => room.id === id)),
    );
    const room = await create();
    await book(room.id);
    const snapshots = async () => ({
      rooms: await prisma.room.findMany({
        include: { images: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'asc' },
      }),
      bookings: await prisma.booking.findMany({ orderBy: { id: 'asc' } }),
      notifications: await prisma.notification.findMany({
        orderBy: { id: 'asc' },
      }),
    });
    const before = await snapshots();
    function seed() {
      const result = spawnSync(
        process.execPath,
        ['-r', 'ts-node/register', 'prisma/seed.ts'],
        {
          env: process.env,
          encoding: 'utf8',
          timeout: 20_000,
        },
      );
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    }
    seed();
    const first = await snapshots();
    expect(first.rooms.length).toBe(
      before.rooms.length + createdSeedIds.length,
    );
    expect(first.bookings).toEqual(before.bookings);
    expect(first.notifications).toEqual(before.notifications);
    expect(
      first.rooms.filter((item) => !createdSeedIds.includes(item.id)),
    ).toEqual(before.rooms);
    seed();
    expect(await snapshots()).toEqual(first);
  }, 50_000);
});
