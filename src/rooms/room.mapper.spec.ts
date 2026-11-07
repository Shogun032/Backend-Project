import { Prisma } from '@prisma/client';
import { toRoomResponse } from './room.mapper';

describe('toRoomResponse', () => {
  const room = {
    id: 'room-1',
    name: 'Deluxe Double',
    description: 'Queen bed',
    capacity: 2,
    pricePerNight: new Prisma.Decimal('1800'),
    isActive: true,
    createdAt: new Date('2026-11-01T09:00:00.000Z'),
    updatedAt: new Date('2026-11-02T09:00:00.000Z'),
    images: [
      {
        id: 'img-1',
        roomId: 'room-1',
        url: 'https://example.com/a.jpg',
        altText: 'Bed',
        sortOrder: 0,
      },
    ],
  };

  it('formats the room as the API contract response', () => {
    expect(toRoomResponse(room)).toEqual({
      id: 'room-1',
      name: 'Deluxe Double',
      description: 'Queen bed',
      capacity: 2,
      pricePerNight: '1800.00',
      currency: 'THB',
      isActive: true,
      images: [
        { url: 'https://example.com/a.jpg', altText: 'Bed', sortOrder: 0 },
      ],
      createdAt: '2026-11-01T09:00:00.000Z',
      updatedAt: '2026-11-02T09:00:00.000Z',
    });
  });

  it.each([
    ['1500', '1500.00'],
    ['1234.5', '1234.50'],
    ['9999999.99', '9999999.99'],
  ])('formats price %s as %s', (input, expected) => {
    const response = toRoomResponse({
      ...room,
      pricePerNight: new Prisma.Decimal(input),
    });
    expect(response.pricePerNight).toBe(expected);
  });
});
