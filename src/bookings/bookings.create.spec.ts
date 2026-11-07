
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BookingsService - Create Booking', () => {
  let service: BookingsService;

  const mockRoom = {
    id: 'room-1',
    name: 'Deluxe Room',
    capacity: 2,
    pricePerNight: new Prisma.Decimal('1000.00'),
    isActive: true,
  };

  const mockBooking = {
    id: 'booking-1',
    userId: 'user-1',
    roomId: 'room-1',
    checkIn: new Date('2026-12-10T00:00:00.000Z'),
    checkOut: new Date('2026-12-12T00:00:00.000Z'),
    guests: 2,
    status: 'PENDING',
    nights: 2,
    pricePerNight: new Prisma.Decimal('1000.00'),
    totalPrice: new Prisma.Decimal('2000.00'),
    currency: 'THB',
  };

  const mockTx = {
    $queryRaw: jest.fn(),
    room: {
      findUnique: jest.fn(),
    },
    booking: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  };

  const mockPrisma = {
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

    mockTx.room.findUnique.mockResolvedValue(mockRoom);
    mockTx.booking.findFirst.mockResolvedValue(null);
    mockTx.booking.create.mockResolvedValue(mockBooking);
    mockTx.notification.create.mockResolvedValue({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a booking successfully', async () => {
    const result = await service.create('user-1', {
      roomId: 'room-1',
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      guests: 2,
    });

    expect(result).toEqual(mockBooking);

    expect(mockTx.booking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        roomId: 'room-1',
        guests: 2,
        status: 'PENDING',
        nights: 2,
        pricePerNight: mockRoom.pricePerNight,
        totalPrice: new Prisma.Decimal('2000.00'),
        currency: 'THB',
      }),
    });

    expect(mockTx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'booking-1',
        type: 'BOOKING_CREATED',
      }),
    });
  });

  it('should reject booking when the room is already booked', async () => {
    mockTx.booking.findFirst.mockResolvedValueOnce({
      id: 'existing-booking',
      status: 'PENDING',
    });

    await expect(
      service.create('user-1', {
        roomId: 'room-1',
        checkIn: '2026-12-10',
        checkOut: '2026-12-12',
        guests: 2,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ROOM_NOT_AVAILABLE',
      }),
    });

    expect(mockTx.booking.create).not.toHaveBeenCalled();
    expect(mockTx.notification.create).not.toHaveBeenCalled();
  });

  it('should reject booking when guests exceed room capacity', async () => {
    await expect(
      service.create('user-1', {
        roomId: 'room-1',
        checkIn: '2026-12-10',
        checkOut: '2026-12-12',
        guests: 3,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'GUESTS_EXCEED_CAPACITY',
      }),
    });

    expect(mockTx.booking.findFirst).not.toHaveBeenCalled();
    expect(mockTx.booking.create).not.toHaveBeenCalled();
    expect(mockTx.notification.create).not.toHaveBeenCalled();
  });

  it('should reject booking when room does not exist', async () => {
    mockTx.room.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.create('user-1', {
        roomId: 'room-1',
        checkIn: '2026-12-10',
        checkOut: '2026-12-12',
        guests: 2,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ROOM_NOT_FOUND',
      }),
    });

    expect(mockTx.booking.findFirst).not.toHaveBeenCalled();
    expect(mockTx.booking.create).not.toHaveBeenCalled();
    expect(mockTx.notification.create).not.toHaveBeenCalled();
  });

  it('should reject booking when room is inactive', async () => {
    mockTx.room.findUnique.mockResolvedValueOnce({
      ...mockRoom,
      isActive: false,
    });

    await expect(
      service.create('user-1', {
        roomId: 'room-1',
        checkIn: '2026-12-10',
        checkOut: '2026-12-12',
        guests: 2,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ROOM_NOT_FOUND',
      }),
    });

    expect(mockTx.booking.findFirst).not.toHaveBeenCalled();
    expect(mockTx.booking.create).not.toHaveBeenCalled();
    expect(mockTx.notification.create).not.toHaveBeenCalled();
  });

});
