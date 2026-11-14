import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BLOCKING_STATUSES } from '../bookings/booking-rules';
import { ApiException } from '../common/exceptions/api.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { SearchRoomsDto } from './dto/search-rooms.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ROOM_INCLUDE } from './room.mapper';
import { RoomsService } from './rooms.service';

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const IMAGE = {
  url: 'https://example.com/a.jpg',
  altText: 'Bed',
  sortOrder: 0,
};

function roomRow(overrides: object = {}) {
  return {
    id: ROOM_ID,
    name: 'Deluxe Double',
    description: '',
    capacity: 2,
    pricePerNight: new Prisma.Decimal('1800'),
    isActive: true,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    images: [],
    ...overrides,
  };
}

async function catchApiError(promise: Promise<unknown>): Promise<ApiException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiException) return error;
    throw error;
  }
  throw new Error('Expected an ApiException');
}

function createMocks() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    room: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    roomImage: { deleteMany: jest.fn(), createMany: jest.fn() },
    booking: { findFirst: jest.fn(), count: jest.fn() },
  };
  const prisma = {
    room: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    // รองรับทั้ง $transaction(callback) และ $transaction([queries])
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => unknown)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
  // Default: cache ว่างเสมอ (miss) เทสต์ที่ต้องการ cache hit ค่อย override
  const redis = {
    getCacheVersion: jest.fn().mockResolvedValue('0'),
    getJson: jest.fn().mockResolvedValue(null),
    setJson: jest.fn().mockResolvedValue(undefined),
    bumpCacheVersion: jest.fn().mockResolvedValue(undefined),
  };
  const service = new RoomsService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
  );
  return { tx, prisma, redis, service };
}

describe('RoomsService', () => {
  describe('search', () => {
    it('filters active rooms by capacity and the shared overlap rule', async () => {
      const { prisma, service } = createMocks();
      prisma.room.findMany.mockResolvedValue([]);
      prisma.room.count.mockResolvedValue(0);
      const query = Object.assign(new SearchRoomsDto(), {
        checkIn: '2099-01-10',
        checkOut: '2099-01-12',
        guests: 2,
      });

      const result = await service.search(query);

      expect(prisma.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            capacity: { gte: 2 },
            bookings: {
              none: {
                status: { in: BLOCKING_STATUSES },
                checkIn: { lt: new Date('2099-01-12T00:00:00.000Z') },
                checkOut: { gt: new Date('2099-01-10T00:00:00.000Z') },
              },
            },
          },
        }),
      );
      expect(result).toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });

    it('rejects invalid dates with the same rule as bookings', async () => {
      const { prisma, service } = createMocks();
      const query = Object.assign(new SearchRoomsDto(), {
        checkIn: '2099-01-12',
        checkOut: '2099-01-10',
        guests: 1,
      });

      const error = await catchApiError(
        Promise.resolve().then(() => service.search(query)),
      );

      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.getResponse()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(prisma.room.findMany).not.toHaveBeenCalled();
    });

    it('does not use the cache (availability must be live)', async () => {
      const { prisma, redis, service } = createMocks();
      prisma.room.findMany.mockResolvedValue([]);
      prisma.room.count.mockResolvedValue(0);
      const query = Object.assign(new SearchRoomsDto(), {
        checkIn: '2099-01-10',
        checkOut: '2099-01-12',
        guests: 1,
      });

      await service.search(query);

      expect(redis.getJson).not.toHaveBeenCalled();
      expect(redis.setJson).not.toHaveBeenCalled();
    });
  });

  describe('findAll (cache)', () => {
    it('reads from the DB on a cache miss and stores the result for 60s', async () => {
      const { prisma, redis, service } = createMocks();
      prisma.room.findMany.mockResolvedValue([roomRow()]);
      prisma.room.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(prisma.room.findMany).toHaveBeenCalledTimes(1);
      expect(result.data).toHaveLength(1);
      expect(redis.setJson).toHaveBeenCalledWith(
        'rooms:v0:list:1:20',
        result,
        60,
      );
    });

    it('returns the cached value without touching the DB on a cache hit', async () => {
      const { prisma, redis, service } = createMocks();
      const cached = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      redis.getJson.mockResolvedValue(cached);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result).toEqual(cached);
      expect(prisma.room.findMany).not.toHaveBeenCalled();
      expect(redis.setJson).not.toHaveBeenCalled();
    });

    it('uses a new key after the cache version is bumped', async () => {
      const { prisma, redis, service } = createMocks();
      redis.getCacheVersion.mockResolvedValue('3');
      prisma.room.findMany.mockResolvedValue([]);
      prisma.room.count.mockResolvedValue(0);

      await service.findAll({ page: 2, limit: 10 });

      expect(redis.getJson).toHaveBeenCalledWith('rooms:v3:list:2:10');
    });
  });

  describe('findOne', () => {
    it('returns 404 for a missing or inactive room', async () => {
      const { prisma, redis, service } = createMocks();
      prisma.room.findFirst.mockResolvedValue(null);

      const error = await catchApiError(service.findOne(ROOM_ID));

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getResponse()).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
      expect(prisma.room.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ROOM_ID, isActive: true } }),
      );
      expect(redis.setJson).not.toHaveBeenCalled();
    });

    it('stores an active room in the cache for 60s', async () => {
      const { prisma, redis, service } = createMocks();
      prisma.room.findFirst.mockResolvedValue(roomRow());

      const result = await service.findOne(ROOM_ID);

      expect(redis.setJson).toHaveBeenCalledWith(
        `rooms:v0:detail:${ROOM_ID}`,
        result,
        60,
      );
    });

    it('returns the cached room without touching the DB on a cache hit', async () => {
      const { prisma, redis, service } = createMocks();
      const cached = { id: ROOM_ID, name: 'Cached room' };
      redis.getJson.mockResolvedValue(cached);

      const result = await service.findOne(ROOM_ID);

      expect(result).toEqual(cached);
      expect(prisma.room.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('stores images, returns the contract response and clears the cache', async () => {
      const { prisma, redis, service } = createMocks();
      prisma.room.create.mockResolvedValue(
        roomRow({ images: [{ id: 'img-1', roomId: ROOM_ID, ...IMAGE }] }),
      );
      const dto = Object.assign(new CreateRoomDto(), {
        name: 'Deluxe Double',
        capacity: 2,
        pricePerNight: '1800.00',
        images: [IMAGE],
      });

      const result = await service.create(dto);

      expect(prisma.room.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Deluxe Double',
          pricePerNight: '1800.00',
          images: { create: [IMAGE] },
        }) as unknown,
        include: ROOM_INCLUDE,
      });
      expect(result.pricePerNight).toBe('1800.00');
      expect(result.images).toEqual([IMAGE]);
      expect(redis.bumpCacheVersion).toHaveBeenCalledWith('rooms');
    });
  });

  describe('update', () => {
    it('rejects an empty PATCH body', async () => {
      const { prisma, redis, service } = createMocks();

      const error = await catchApiError(
        service.update(ROOM_ID, new UpdateRoomDto()),
      );

      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.getResponse()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(redis.bumpCacheVersion).not.toHaveBeenCalled();
    });

    it('locks the room before reading it and returns 404 when missing', async () => {
      const { tx, service } = createMocks();
      tx.room.findUnique.mockResolvedValue(null);

      const error = await catchApiError(
        service.update(
          ROOM_ID,
          Object.assign(new UpdateRoomDto(), { name: 'New' }),
        ),
      );

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.room.findUnique.mock.invocationCallOrder[0],
      );
    });

    it('rejects lowering capacity below an active booking', async () => {
      const { tx, redis, service } = createMocks();
      tx.room.findUnique.mockResolvedValue(roomRow({ capacity: 4 }));
      tx.booking.findFirst.mockResolvedValue({ id: 'booking-1' });

      const error = await catchApiError(
        service.update(
          ROOM_ID,
          Object.assign(new UpdateRoomDto(), { capacity: 2 }),
        ),
      );

      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(error.getResponse()).toMatchObject({
        code: 'ROOM_CAPACITY_CONFLICT',
      });
      expect(tx.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roomId: ROOM_ID,
            status: { in: BLOCKING_STATUSES },
            guests: { gt: 2 },
          }) as unknown,
        }),
      );
      expect(tx.room.update).not.toHaveBeenCalled();
      expect(redis.bumpCacheVersion).not.toHaveBeenCalled();
    });

    it('replaces all images when images are sent and clears the cache', async () => {
      const { tx, redis, service } = createMocks();
      tx.room.findUnique.mockResolvedValue(roomRow());
      tx.room.update.mockResolvedValue(
        roomRow({ images: [{ id: 'img-1', roomId: ROOM_ID, ...IMAGE }] }),
      );

      const result = await service.update(
        ROOM_ID,
        Object.assign(new UpdateRoomDto(), { images: [IMAGE] }),
      );

      expect(tx.roomImage.deleteMany).toHaveBeenCalledWith({
        where: { roomId: ROOM_ID },
      });
      expect(tx.roomImage.createMany).toHaveBeenCalledWith({
        data: [{ ...IMAGE, roomId: ROOM_ID }],
      });
      expect(tx.room.update).toHaveBeenCalledWith({
        where: { id: ROOM_ID },
        data: {},
        include: ROOM_INCLUDE,
      });
      expect(result.images).toEqual([IMAGE]);
      expect(redis.bumpCacheVersion).toHaveBeenCalledWith('rooms');
    });
  });

  describe('remove', () => {
    it('refuses to delete a room with booking history', async () => {
      const { tx, redis, service } = createMocks();
      tx.room.findUnique.mockResolvedValue(roomRow());
      tx.booking.count.mockResolvedValue(1);

      const error = await catchApiError(service.remove(ROOM_ID));

      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(error.getResponse()).toMatchObject({ code: 'ROOM_HAS_BOOKINGS' });
      expect(tx.room.delete).not.toHaveBeenCalled();
      expect(redis.bumpCacheVersion).not.toHaveBeenCalled();
    });

    it('deletes a room without bookings and clears the cache', async () => {
      const { tx, redis, service } = createMocks();
      tx.room.findUnique.mockResolvedValue(roomRow());
      tx.booking.count.mockResolvedValue(0);

      await service.remove(ROOM_ID);

      expect(tx.room.delete).toHaveBeenCalledWith({ where: { id: ROOM_ID } });
      expect(redis.bumpCacheVersion).toHaveBeenCalledWith('rooms');
    });
  });
});