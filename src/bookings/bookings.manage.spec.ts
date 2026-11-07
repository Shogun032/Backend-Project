
import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BookingsService - Manage Bookings', () => {
  let service: BookingsService;

  const mockBooking = {
    id: 'booking-1',
    userId: 'user-1',
    roomId: 'room-1',
    checkIn: new Date('2026-12-10T00:00:00.000Z'),
    checkOut: new Date('2026-12-12T00:00:00.000Z'),
    guests: 2,
    status: 'PENDING',
  };

  const mockTx = {
    booking: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  };

  const mockPrisma = {
    booking: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);

    jest.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(
      async (callback) => callback(mockTx),
    );

    mockPrisma.booking.findMany.mockResolvedValue([mockBooking]);
    mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);

    mockTx.booking.findFirst.mockResolvedValue(mockBooking);
    mockTx.booking.update.mockResolvedValue({
      ...mockBooking,
      status: 'CANCELLED',
    });

    mockTx.notification.create.mockResolvedValue({});
  });

  // LIST BOOKINGS
  it('should return only the logged-in user bookings', async () => {
    const result = await service.findAllByUser('user-1');

    expect(result).toEqual([mockBooking]);

    expect(mockPrisma.booking.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  // BOOKING DETAIL
  it('should return booking details belonging to the user', async () => {
    const result = await service.findOneByUser(
      'booking-1',
      'user-1',
    );

    expect(result).toEqual(mockBooking);

    expect(mockPrisma.booking.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        userId: 'user-1',
      },
      include: { room: true },
    });
  });

  it('should reject when booking does not belong to the user', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue(null);

    await expect(
      service.findOneByUser('booking-1', 'user-2'),
    ).rejects.toThrow('Booking not found');
  });

  // CANCEL BOOKING
  it('should cancel a pending booking successfully', async () => {
    const result = await service.cancel('booking-1', 'user-1');

    expect(result.status).toBe('CANCELLED');

    expect(mockTx.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'CANCELLED' },
    });

    expect(mockTx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'booking-1',
        type: 'BOOKING_CANCELLED',
      }),
    });
  });

  it('should reject when booking does not belong to the user', async () => {
    mockTx.booking.findFirst.mockResolvedValue(null);

    await expect(
      service.cancel('booking-1', 'user-2'),
    ).rejects.toThrow('Booking not found');
  });

  it('should reject cancellation when booking is already paid', async () => {
    mockTx.booking.findFirst.mockResolvedValue({
      ...mockBooking,
      status: 'PAID',
    });

    await expect(
      service.cancel('booking-1', 'user-1'),
    ).rejects.toThrow('This booking cannot be cancelled');
  });

  it('should return the booking if it is already cancelled', async () => {
    const cancelledBooking = {
      ...mockBooking,
      status: 'CANCELLED',
    };

    mockTx.booking.findFirst.mockResolvedValue(cancelledBooking);

    const result = await service.cancel('booking-1', 'user-1');

    expect(result).toEqual(cancelledBooking);
    expect(mockTx.booking.update).not.toHaveBeenCalled();
    expect(mockTx.notification.create).not.toHaveBeenCalled();
  });
});
