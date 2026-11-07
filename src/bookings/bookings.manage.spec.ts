import { Booking, Prisma } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListBookingsDto } from './dto/list-bookings.dto';

const booking: Booking = {
  id: 'booking-1',
  userId: 'user-1',
  roomId: 'room-1',
  checkIn: new Date('2026-12-10T00:00:00Z'),
  checkOut: new Date('2026-12-12T00:00:00Z'),
  guests: 2,
  status: 'PENDING',
  nights: 2,
  pricePerNight: new Prisma.Decimal('1000'),
  totalPrice: new Prisma.Decimal('2000'),
  currency: 'THB',
  createdAt: new Date('2026-11-07T00:00:00Z'),
  updatedAt: new Date('2026-11-07T00:00:00Z'),
};
const response = {
  ...booking,
  checkIn: '2026-12-10',
  checkOut: '2026-12-12',
  pricePerNight: '1000.00',
  totalPrice: '2000.00',
};

function createMocks() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    booking: {
      findFirst: jest.fn().mockResolvedValue(booking),
      update: jest.fn().mockResolvedValue({ ...booking, status: 'CANCELLED' }),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    booking: {
      findMany: jest.fn().mockResolvedValue([booking]),
      findFirst: jest.fn().mockResolvedValue(booking),
      count: jest.fn().mockResolvedValue(1),
    },
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => Promise<unknown>)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
  return {
    tx,
    prisma,
    service: new BookingsService(prisma as unknown as PrismaService),
  };
}

describe('BookingsService - Manage Bookings', () => {
  beforeEach(() =>
    jest.useFakeTimers({ now: new Date('2026-11-07T09:00:00Z') }),
  );
  afterEach(() => jest.useRealTimers());

  it('lists only the owner bookings with filtering and pagination', async () => {
    const { service, prisma } = createMocks();
    const query = Object.assign(new ListBookingsDto(), {
      page: 2,
      limit: 5,
      status: 'PENDING',
    });
    expect(await service.findAllByUser('user-1', query)).toEqual({
      data: [response],
      meta: { page: 2, limit: 5, total: 1, totalPages: 1 },
    });
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'PENDING' },
      skip: 5,
      take: 5,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'PENDING' },
    });
  });

  it('returns the owner booking in the public date and price format', async () => {
    const { service, prisma } = createMocks();
    expect(await service.findOneByUser(booking.id, 'user-1')).toEqual(response);
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: { id: booking.id, userId: 'user-1' },
    });
  });

  it('does not disclose another user booking', async () => {
    const { service, prisma } = createMocks();
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(
      service.findOneByUser(booking.id, 'user-2'),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: { id: booking.id, userId: 'user-2' },
    });
  });

  it('cancels with an owner filter, rereads after the room lock and creates one notification', async () => {
    const { service, tx } = createMocks();
    expect(await service.cancel(booking.id, 'user-1')).toEqual({
      ...response,
      status: 'CANCELLED',
    });
    expect(tx.booking.findFirst).toHaveBeenNthCalledWith(2, {
      where: { id: booking.id, userId: 'user-1' },
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.booking.findFirst.mock.invocationCallOrder[1],
    );
    expect(tx.booking.update).toHaveBeenCalledWith({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
    });
    expect(tx.notification.create.mock.calls[0]).toMatchObject([
      { data: { bookingId: booking.id, type: 'BOOKING_CANCELLED' } },
    ]);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });

  it('rejects cancelling a booking belonging to someone else', async () => {
    const { service, tx } = createMocks();
    tx.booking.findFirst.mockResolvedValue(null);
    await expect(service.cancel(booking.id, 'user-2')).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('rejects cancelling a paid booking', async () => {
    const { service, tx } = createMocks();
    tx.booking.findFirst.mockResolvedValue({ ...booking, status: 'PAID' });
    await expect(service.cancel(booking.id, 'user-1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'INVALID_STATUS_TRANSITION' },
    });
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('returns an already cancelled booking without duplicate notifications', async () => {
    const { service, tx } = createMocks();
    tx.booking.findFirst.mockResolvedValue({ ...booking, status: 'CANCELLED' });
    expect(await service.cancel(booking.id, 'user-1')).toEqual({
      ...response,
      status: 'CANCELLED',
    });
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('validates the current status again after waiting for a room lock', async () => {
    const { service, tx } = createMocks();
    tx.booking.findFirst
      .mockResolvedValueOnce(booking)
      .mockResolvedValueOnce({ ...booking, status: 'PAID' });
    await expect(service.cancel(booking.id, 'user-1')).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.booking.update).not.toHaveBeenCalled();
  });
});
