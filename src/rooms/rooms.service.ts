import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRoomDto } from './dto/update-room.dto';

function todayInBangkok(): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
  }).format(new Date());
  return new Date(`${ymd}T00:00:00.000Z`);
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.room.findMany({
      where: { isActive: true },
      include: { images: true },
    });
  }

  private lockRoom(tx: Prisma.TransactionClient, roomId: string) {
    return tx.$queryRaw`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;
  }

  async update(roomId: string, dto: UpdateRoomDto) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one field is required',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockRoom(tx, roomId);

      const room = await tx.room.findUnique({ where: { id: roomId } });
      if (!room) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Room not found',
        });
      }

      if (dto.capacity !== undefined) {
        const conflict = await tx.booking.findFirst({
          where: {
            roomId,
            status: { in: ['PENDING', 'APPROVED', 'PAID'] },
            checkOut: { gt: todayInBangkok() },
            guests: { gt: dto.capacity },
          },
        });
        if (conflict) {
          throw new ConflictException({
            code: 'ROOM_CAPACITY_CONFLICT',
            message: 'Capacity is lower than guests of an active booking',
          });
        }
      }

      const { images, ...roomData } = dto;

      if (images !== undefined) {
        await tx.roomImage.deleteMany({ where: { roomId } });
        if (images.length > 0) {
          await tx.roomImage.createMany({
            data: images.map((image) => ({ ...image, roomId })),
          });
        }
      }

      return tx.room.update({
        where: { id: roomId },
        data: roomData,
        include: { images: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  async remove(roomId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockRoom(tx, roomId);

      const room = await tx.room.findUnique({ where: { id: roomId } });
      if (!room) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Room not found',
        });
      }

      const bookingCount = await tx.booking.count({ where: { roomId } });
      if (bookingCount > 0) {
        throw new ConflictException({
          code: 'ROOM_HAS_BOOKINGS',
          message: 'Room has bookings; set isActive to false instead',
        });
      }

      await tx.roomImage.deleteMany({ where: { roomId } });
      await tx.room.delete({ where: { id: roomId } });
    });
  }
}