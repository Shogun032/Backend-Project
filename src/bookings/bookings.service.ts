import { Injectable } from '@nestjs/common';
import { Booking, BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/exceptions/api.exception';
import { paginationMeta } from '../common/dto/pagination.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AdminListBookingsDto, ListBookingsDto } from './dto/list-bookings.dto';
import {
  assertStatusTransition,
  blockingOverlap,
  dateOnly,
  parseBookingDates,
} from './booking-rules';

function bookingResponse(booking: Booking) {
  return {
    ...booking,
    checkIn: dateOnly(booking.checkIn),
    checkOut: dateOnly(booking.checkOut),
    pricePerNight: booking.pricePerNight.toFixed(2),
    totalPrice: booking.totalPrice.toFixed(2),
  };
}

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async writeTransaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      // Read again after taking the Room lock, without an earlier snapshot.
      return await this.prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2028', 'P2024', 'P1001', 'P1002', 'P1017'].includes(
          error.code,
        )
      ) {
        throw new ApiException(
          503,
          'SERVICE_UNAVAILABLE',
          'Service temporarily unavailable; please retry',
        );
      }
      throw error;
    }
  }

  private async lockRoom(tx: Prisma.TransactionClient, roomId: string) {
    await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;
  }

  async create(userId: string, dto: CreateBookingDto) {
    const { checkIn, checkOut, nights } = parseBookingDates(
      dto.checkIn,
      dto.checkOut,
    );
    const booking = await this.writeTransaction(async (tx) => {
      await this.lockRoom(tx, dto.roomId);
      const room = await tx.room.findUnique({ where: { id: dto.roomId } });
      if (!room)
        throw new ApiException(404, 'RESOURCE_NOT_FOUND', 'Room not found');
      if (!room.isActive)
        throw new ApiException(409, 'ROOM_UNAVAILABLE', 'Room unavailable');
      if (dto.guests > room.capacity) {
        throw new ApiException(
          400,
          'VALIDATION_ERROR',
          'Guests exceed room capacity',
        );
      }
      const conflict = await tx.booking.findFirst({
        where: { roomId: room.id, ...blockingOverlap(checkIn, checkOut) },
      });
      if (conflict)
        throw new ApiException(409, 'ROOM_UNAVAILABLE', 'Room unavailable');

      const created = await tx.booking.create({
        data: {
          userId,
          roomId: room.id,
          checkIn,
          checkOut,
          nights,
          guests: dto.guests,
          status: 'PENDING',
          pricePerNight: room.pricePerNight,
          totalPrice: room.pricePerNight.mul(nights),
          currency: 'THB',
        },
      });
      await tx.notification.create({
        data: {
          bookingId: created.id,
          type: 'BOOKING_CREATED',
          message: 'Your booking has been created',
        },
      });
      return created;
    });
    return bookingResponse(booking);
  }

  private async list(where: Prisma.BookingWhereInput, query: ListBookingsDto) {
    const { page, limit } = query;
    const [bookings, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      data: bookings.map(bookingResponse),
      meta: paginationMeta(page, limit, total),
    };
  }

  findAllByUser(userId: string, query: ListBookingsDto) {
    return this.list({ userId, status: query.status }, query);
  }

  async findOneByUser(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
    });
    if (!booking)
      throw new ApiException(404, 'RESOURCE_NOT_FOUND', 'Booking not found');
    return bookingResponse(booking);
  }

  findAllForAdmin(query: AdminListBookingsDto) {
    return this.list(
      { status: query.status, userId: query.userId, roomId: query.roomId },
      query,
    );
  }

  async findOneForAdmin(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking)
      throw new ApiException(404, 'RESOURCE_NOT_FOUND', 'Booking not found');
    return bookingResponse(booking);
  }

  cancel(bookingId: string, userId: string, status: 'CANCELLED' = 'CANCELLED') {
    return this.changeStatus(bookingId, status, userId);
  }

  updateStatusByAdmin(
    bookingId: string,
    status: 'APPROVED' | 'PAID' | 'CANCELLED',
  ) {
    return this.changeStatus(bookingId, status);
  }

  private async changeStatus(
    bookingId: string,
    status: BookingStatus,
    userId?: string,
  ) {
    const updated = await this.writeTransaction(async (tx) => {
      const where = { id: bookingId, ...(userId ? { userId } : {}) };
      const initial = await tx.booking.findFirst({ where });
      if (!initial)
        throw new ApiException(404, 'RESOURCE_NOT_FOUND', 'Booking not found');
      await this.lockRoom(tx, initial.roomId);
      const booking = await tx.booking.findFirst({ where });
      if (!booking)
        throw new ApiException(404, 'RESOURCE_NOT_FOUND', 'Booking not found');
      assertStatusTransition(booking.status, status, booking.checkIn);
      if (booking.status === status) return booking;

      if (status === 'APPROVED') {
        const conflict = await tx.booking.findFirst({
          where: {
            roomId: booking.roomId,
            id: { not: booking.id },
            ...blockingOverlap(booking.checkIn, booking.checkOut),
          },
        });
        if (conflict)
          throw new ApiException(409, 'ROOM_UNAVAILABLE', 'Room unavailable');
      }
      const result = await tx.booking.update({
        where: { id: bookingId },
        data: { status },
      });
      if (status === 'CANCELLED') {
        await tx.notification.create({
          data: {
            bookingId,
            type: 'BOOKING_CANCELLED',
            message: 'Your booking has been cancelled',
          },
        });
      }
      return result;
    });
    return bookingResponse(updated);
  }
}
