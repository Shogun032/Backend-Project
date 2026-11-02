import { BookingStatus } from '@prisma/client';
import { ApiException } from '../common/exceptions/api.exception';

export const BLOCKING_STATUSES: BookingStatus[] = [
  'PENDING',
  'APPROVED',
  'PAID',
];

export function bangkokToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseBookingDates(
  checkIn: string,
  checkOut: string,
  now = new Date(),
) {
  const start = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    dateOnly(start) !== checkIn ||
    dateOnly(end) !== checkOut ||
    checkIn < bangkokToday(now) ||
    checkOut <= checkIn
  ) {
    throw new ApiException(400, 'VALIDATION_ERROR', 'Invalid booking dates');
  }
  return {
    checkIn: start,
    checkOut: end,
    nights: (end.getTime() - start.getTime()) / 86_400_000,
  };
}

// Share this predicate with room search; checkout is excluded from the stay.
export function blockingOverlap(checkIn: Date, checkOut: Date) {
  return {
    status: { in: BLOCKING_STATUSES },
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
  };
}

export function assertStatusTransition(
  current: BookingStatus,
  next: BookingStatus,
  checkIn: Date,
  now = new Date(),
) {
  if (current === next) return;
  const today = bangkokToday(now);
  const arrival = dateOnly(checkIn);
  const allowed =
    (current === 'PENDING' && next === 'APPROVED' && today <= arrival) ||
    (current === 'APPROVED' && next === 'PAID' && today <= arrival) ||
    (['PENDING', 'APPROVED'].includes(current) &&
      next === 'CANCELLED' &&
      today < arrival);
  if (!allowed) {
    throw new ApiException(
      409,
      'INVALID_STATUS_TRANSITION',
      'Booking status cannot be changed',
    );
  }
}
