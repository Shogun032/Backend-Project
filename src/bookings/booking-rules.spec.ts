import { ApiException } from '../common/exceptions/api.exception';
import {
  assertStatusTransition,
  bangkokToday,
  parseBookingDates,
} from './booking-rules';

const now = new Date('2026-10-28T09:00:00Z');
const arrival = new Date('2026-10-30T00:00:00Z');

describe('Booking date and status rules', () => {
  it('allows same-day check-in and counts calendar nights', () => {
    expect(parseBookingDates('2026-10-28', '2026-10-30', now).nights).toBe(2);
  });

  it.each([
    ['2026-02-30', '2026-03-02'],
    ['2026-10-27', '2026-10-30'],
    ['2026-10-30', '2026-10-30'],
    ['2026-10-30', '2026-10-29'],
    ['2026-1-01', '2026-10-30'],
  ])('rejects invalid or past dates: %s to %s', (start, end) => {
    expect(() => parseBookingDates(start, end, now)).toThrow(ApiException);
  });

  it('uses Bangkok midnight even when the UTC date is still yesterday', () => {
    const midnight = new Date('2026-10-29T17:00:00Z');
    expect(bangkokToday(midnight)).toBe('2026-10-30');
    expect(() =>
      parseBookingDates('2026-10-29', '2026-10-31', midnight),
    ).toThrow(ApiException);
    expect(() =>
      assertStatusTransition('PENDING', 'CANCELLED', arrival, midnight),
    ).toThrow(ApiException);
    expect(() =>
      assertStatusTransition('PENDING', 'APPROVED', arrival, midnight),
    ).not.toThrow();
    expect(() =>
      assertStatusTransition('APPROVED', 'PAID', arrival, midnight),
    ).not.toThrow();
  });

  it('rejects approval or payment after check-in and terminal status changes', () => {
    const after = new Date('2026-10-31T09:00:00Z');
    expect(() =>
      assertStatusTransition('PENDING', 'APPROVED', arrival, after),
    ).toThrow(ApiException);
    expect(() =>
      assertStatusTransition('APPROVED', 'PAID', arrival, after),
    ).toThrow(ApiException);
    expect(() =>
      assertStatusTransition('CANCELLED', 'APPROVED', arrival, now),
    ).toThrow(ApiException);
    expect(() =>
      assertStatusTransition('PAID', 'CANCELLED', arrival, now),
    ).toThrow(ApiException);
  });

  it('allows future cancellation and repeated status requests', () => {
    expect(() =>
      assertStatusTransition('APPROVED', 'CANCELLED', arrival, now),
    ).not.toThrow();
    expect(() =>
      assertStatusTransition('CANCELLED', 'CANCELLED', arrival, now),
    ).not.toThrow();
  });
});
