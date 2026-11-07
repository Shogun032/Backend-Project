import { Booking, Prisma } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';

const input = {
  roomId: 'room-1',
  checkIn: '2026-12-10',
  checkOut: '2026-12-12',
  guests: 2,
};
const room = {
  id: 'room-1',
  capacity: 2,
  pricePerNight: new Prisma.Decimal('1000'),
  isActive: true,
};
const booking: Booking = {
  id: 'booking-1',
  userId: 'user-1',
  roomId: room.id,
  checkIn: new Date('2026-12-10T00:00:00Z'),
  checkOut: new Date('2026-12-12T00:00:00Z'),
  guests: 2,
  status: 'PENDING',
  nights: 2,
  pricePerNight: room.pricePerNight,
  totalPrice: new Prisma.Decimal('2000'),
  currency: 'THB',
  createdAt: new Date('2026-11-07T00:00:00Z'),
  updatedAt: new Date('2026-11-07T00:00:00Z'),
};

function createMocks() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    room: { findUnique: jest.fn().mockResolvedValue(room) },
    booking: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(booking),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  return {
    tx,
    prisma,
    service: new BookingsService(prisma as unknown as PrismaService),
  };
}

describe('BookingsService - Create Booking', () => {
  beforeEach(() =>
    jest.useFakeTimers({ now: new Date('2026-11-07T09:00:00Z') }),
  );
  afterEach(() => jest.useRealTimers());

  it('creates a priced booking and notification in the same locked transaction', async () => {
    const { service, tx, prisma } = createMocks();
    const result = await service.create('user-1', input);
    expect(result).toEqual({
      ...booking,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      pricePerNight: '1000.00',
      totalPrice: '2000.00',
    });
    expect(tx.booking.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        roomId: room.id,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guests: 2,
        status: 'PENDING',
        nights: 2,
        pricePerNight: room.pricePerNight,
        totalPrice: new Prisma.Decimal('2000'),
        currency: 'THB',
      },
    });
    expect(tx.notification.create.mock.calls[0]).toMatchObject([
      {
        data: {
          bookingId: booking.id,
          type: 'BOOKING_CREATED',
        },
      },
    ]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.room.findUnique.mock.invocationCallOrder[0],
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'ReadCommitted' }),
    );
  });

  it.each([
    { kind: 'overlap', code: 'ROOM_UNAVAILABLE', status: 409 },
    { kind: 'capacity', code: 'VALIDATION_ERROR', status: 400 },
    { kind: 'missing', code: 'RESOURCE_NOT_FOUND', status: 404 },
    { kind: 'inactive', code: 'ROOM_UNAVAILABLE', status: 409 },
  ])(
    'rejects $kind without inserting booking or notification',
    async ({ kind, code, status }) => {
      const { service, tx } = createMocks();
      if (kind === 'overlap')
        tx.booking.findFirst.mockResolvedValue({ id: 'existing' });
      if (kind === 'missing') tx.room.findUnique.mockResolvedValue(null);
      if (kind === 'inactive')
        tx.room.findUnique.mockResolvedValue({ ...room, isActive: false });
      await expect(
        service.create('user-1', {
          ...input,
          guests: kind === 'capacity' ? 3 : 2,
        }),
      ).rejects.toMatchObject({ status, response: { code } });
      expect(tx.booking.create).not.toHaveBeenCalled();
      expect(tx.notification.create).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid dates before starting a transaction', async () => {
    const { service, prisma } = createMocks();
    await expect(
      service.create('user-1', { ...input, checkIn: '2026-02-30' }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails the transaction if notification creation fails', async () => {
    const { service, tx } = createMocks();
    const failure = new Error('Notification insert failed');
    tx.notification.create.mockRejectedValue(failure);
    await expect(service.create('user-1', input)).rejects.toBe(failure);
  });

  it('maps transaction deadlocks to a retryable service error', async () => {
    const { service, prisma } = createMocks();
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('deadlock', {
        code: 'P2034',
        clientVersion: '6.19.3',
      }),
    );
    await expect(service.create('user-1', input)).rejects.toMatchObject({
      status: 503,
      response: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});
