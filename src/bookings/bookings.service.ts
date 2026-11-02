import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ApiException } from '../common/exceptions/api.exception';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new booking
  async create(userId: string, dto: CreateBookingDto) {
    const checkIn = new Date(`${dto.checkIn}T00:00:00.000Z`);
    const checkOut = new Date(`${dto.checkOut}T00:00:00.000Z`);

    if (
      Number.isNaN(checkIn.getTime()) ||
      Number.isNaN(checkOut.getTime()) ||
      checkIn.toISOString().slice(0, 10) !== dto.checkIn ||
      checkOut.toISOString().slice(0, 10) !== dto.checkOut
    ) {
      throw new ApiException(400, 'INVALID_DATE', 'Invalid booking date');
    }

    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Bangkok',
    });

    if (dto.checkIn < today || dto.checkOut <= dto.checkIn) {
      throw new ApiException(
        400,
        'INVALID_DATE_RANGE',
        'Invalid check-in or check-out date',
      );
    }

    const nights =
      (checkOut.getTime() - checkIn.getTime()) /
      (1000 * 60 * 60 * 24);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM rooms
        WHERE id = ${dto.roomId}
        FOR UPDATE
      `;

      const room = await tx.room.findUnique({
        where: { id: dto.roomId },
      });

      if (!room || !room.isActive) {
        throw new ApiException(
          404,
          'ROOM_NOT_FOUND',
          'Room not found or inactive',
        );
      }

      if (dto.guests > room.capacity) {
        throw new ApiException(
          400,
          'GUESTS_EXCEED_CAPACITY',
          'Guests exceed room capacity',
        );
      }

      const conflict = await tx.booking.findFirst({
        where: {
          roomId: dto.roomId,
          status: { in: ['PENDING', 'APPROVED', 'PAID'] },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      });

      if (conflict) {
        throw new ApiException(
          409,
          'ROOM_NOT_AVAILABLE',
          'Room is already booked for these dates',
        );
      }

      const pricePerNight = room.pricePerNight;
      const totalPrice = new Prisma.Decimal(
        pricePerNight.toString(),
      ).mul(nights);

      const booking = await tx.booking.create({
        data: {
          id: randomUUID(),
          userId,
          roomId: dto.roomId,
          checkIn,
          checkOut,
          guests: dto.guests,
          status: 'PENDING',
          nights,
          pricePerNight,
          totalPrice,
          currency: 'THB',
        },
      });

      await tx.notification.create({
        data: {
          id: randomUUID(),
          bookingId: booking.id,
          type: 'BOOKING_CREATED',
          message: 'Your booking has been created successfully',
        },
      });

      return booking;
    });
  }

  // Get all bookings belonging to a user
  async findAllByUser(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get one booking belonging to a user
  async findOneByUser(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
      include: {
        room: true,
      },
    });

    if (!booking) {
      throw new ApiException(
        404,
        'BOOKING_NOT_FOUND',
        'Booking not found',
      );
    }

    return booking;
  }

  // Cancel a booking
  async cancel(bookingId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          id: bookingId,
          userId,
        },
      });

      if (!booking) {
        throw new ApiException(
          404,
          'BOOKING_NOT_FOUND',
          'Booking not found',
        );
      }

      if (booking.status === 'CANCELLED') {
        return booking;
      }

      if (!['PENDING', 'APPROVED'].includes(booking.status)) {
        throw new ApiException(
          400,
          'BOOKING_CANNOT_BE_CANCELLED',
          'This booking cannot be cancelled',
        );
      }

      const today = new Date().toLocaleDateString('en-CA', {
        timeZone: 'Asia/Bangkok',
      });

      const checkIn = booking.checkIn.toISOString().slice(0, 10);

      if (today >= checkIn) {
        throw new ApiException(
          400,
          'CANCELLATION_DEADLINE_PASSED',
          'Booking cannot be cancelled on or after check-in date',
        );
      }

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });

      await tx.notification.create({
        data: {
          id: randomUUID(),
          bookingId: booking.id,
          type: 'BOOKING_CANCELLED',
          message: 'Your booking has been cancelled successfully',
        },
      });

      return updatedBooking;
    });
  }

  // Admin: Get all bookings from all users
  async findAllForAdmin() {
    return this.prisma.booking.findMany({
      include: {
        room: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Admin: Get one booking by ID
  async findOneForAdmin(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: true,
      },
    });

    if (!booking) {
      throw new ApiException(
        404,
        'BOOKING_NOT_FOUND',
        'Booking not found',
      );
    }

    return booking;
  }

  // Admin: Update booking status
  async updateStatusByAdmin(
    bookingId: string,
    status: 'APPROVED' | 'PAID' | 'CANCELLED',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new ApiException(
          404,
          'BOOKING_NOT_FOUND',
          'Booking not found',
        );
      }

      // Repeating the same status does not create another notification
      if (booking.status === status) {
        return booking;
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      if (status === 'APPROVED' && booking.status !== 'PENDING') {
        throw new ApiException(
          400,
          'INVALID_STATUS_TRANSITION',
          'Only PENDING bookings can be approved',
        );
      }

      if (status === 'PAID' && booking.status !== 'APPROVED') {
        throw new ApiException(
          400,
          'INVALID_STATUS_TRANSITION',
          'Only APPROVED bookings can be marked as PAID',
        );
      }

      if (status === 'CANCELLED') {
        if (!['PENDING', 'APPROVED'].includes(booking.status)) {
          throw new ApiException(
            400,
            'INVALID_STATUS_TRANSITION',
            'This booking cannot be cancelled',
          );
        }

        if (today >= booking.checkIn) {
          throw new ApiException(
            400,
            'CANCELLATION_DEADLINE_PASSED',
            'Booking cannot be cancelled on or after check-in date',
          );
        }
      }

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status },
      });

      await tx.notification.create({
        data: {
          id: randomUUID(),
          bookingId,
          type: `BOOKING_${status}`,
          message: `Your booking status has been updated to ${status}`,
        },
      });

      return updatedBooking;
    });
  }
}
