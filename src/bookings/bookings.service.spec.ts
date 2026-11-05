import { BookingsService } from './bookings.service';
import { ApiException } from '../common/exceptions/api.exception';

describe('BookingsService - Booking date validation', () => {
  let service: BookingsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
    };

    service = new BookingsService(prisma);
  });

  it('should reject an invalid calendar date', async () => {
    await expect(
      service.create('user-1', {
        roomId: 'room-1',
        checkIn: '2026-02-30',
        checkOut: '2026-03-02',
        guests: 2,
      }),
    ).rejects.toBeInstanceOf(ApiException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should reject check-in dates in the past', async () => {
    await expect(
      service.create('user-1', {
        roomId: 'room-1',
        checkIn: '2020-01-01',
        checkOut: '2020-01-03',
        guests: 2,
      }),
    ).rejects.toBeInstanceOf(ApiException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should reject check-out before check-in', async () => {
    await expect(
      service.create('user-1', {
        roomId: 'room-1',
        checkIn: '2026-11-12',
        checkOut: '2026-11-10',
        guests: 2,
      }),
    ).rejects.toBeInstanceOf(ApiException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should reject check-out equal to check-in', async () => {
    await expect(
      service.create('user-1', {
        roomId: 'room-1',
        checkIn: '2026-11-12',
        checkOut: '2026-11-12',
        guests: 2,
      }),
    ).rejects.toBeInstanceOf(ApiException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
