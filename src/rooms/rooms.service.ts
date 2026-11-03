import { HttpStatus, Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PaginationDto, paginationMeta } from '../common/dto/pagination.dto';
import { ApiException } from '../common/exceptions/api.exception';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListRoomsDto } from './dto/admin-list-rooms.dto';
import { CreateRoomDto, RoomImageDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ROOM_INCLUDE, toRoomResponse } from './room.mapper';

// สถานะที่กันห้อง ตามข้อตกลง API หัวข้อ 6
// ถ้า booking-rules.ts export ค่านี้ไว้แล้ว ให้ import มาใช้แทน
const ROOM_BLOCKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.PAID,
];

// วันนี้ตามเวลา Asia/Bangkok ในรูป Date เที่ยงคืน UTC เพื่อเทียบกับคอลัมน์ DATE
// ถ้า booking-rules.ts มีฟังก์ชันแบบนี้อยู่แล้ว ให้ import มาใช้แทน
function todayInBangkok(): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
  }).format(new Date()); // "YYYY-MM-DD"
  return new Date(`${ymd}T00:00:00.000Z`);
}

function toImageData(image: RoomImageDto) {
  return {
    url: image.url,
    altText: image.altText,
    sortOrder: image.sortOrder,
  };
}

function roomNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    'RESOURCE_NOT_FOUND',
    'Room not found',
  );
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Public ----------

  findAll(query: PaginationDto) {
    return this.list({ isActive: true }, query);
  }

  async findOne(roomId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, isActive: true },
      include: ROOM_INCLUDE,
    });
    if (!room) throw roomNotFound();
    return toRoomResponse(room);
  }

  // ---------- Admin ----------

  findAllForAdmin(query: AdminListRoomsDto) {
    const where: Prisma.RoomWhereInput =
      query.isActive === undefined ? {} : { isActive: query.isActive };
    return this.list(where, query);
  }

  async findOneForAdmin(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: ROOM_INCLUDE,
    });
    if (!room) throw roomNotFound();
    return toRoomResponse(room);
  }

  async create(dto: CreateRoomDto) {
    const { images = [], ...roomData } = dto;
    const room = await this.prisma.room.create({
      data: {
        ...roomData,
        images: { create: images.map(toImageData) },
      },
      include: ROOM_INCLUDE,
    });
    return toRoomResponse(room);
  }

  async update(roomId: string, dto: UpdateRoomDto) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'At least one field is required',
      );
    }

    const room = await this.prisma.$transaction(async (tx) => {
      await this.lockRoom(tx, roomId);

      const existing = await tx.room.findUnique({ where: { id: roomId } });
      if (!existing) throw roomNotFound();

      if (dto.capacity !== undefined) {
        const conflict = await tx.booking.findFirst({
          where: {
            roomId,
            status: { in: ROOM_BLOCKING_STATUSES },
            checkOut: { gt: todayInBangkok() },
            guests: { gt: dto.capacity },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'ROOM_CAPACITY_CONFLICT',
            'Capacity is lower than guests of an active booking',
          );
        }
      }

      const { images, ...roomData } = dto;

      // PATCH images = แทนที่ทั้ง Array
      if (images !== undefined) {
        await tx.roomImage.deleteMany({ where: { roomId } });
        if (images.length > 0) {
          await tx.roomImage.createMany({
            data: images.map((image) => ({ ...toImageData(image), roomId })),
          });
        }
      }

      return tx.room.update({
        where: { id: roomId },
        data: roomData,
        include: ROOM_INCLUDE,
      });
    });

    return toRoomResponse(room);
  }

  async remove(roomId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockRoom(tx, roomId);

      const existing = await tx.room.findUnique({ where: { id: roomId } });
      if (!existing) throw roomNotFound();

      const bookingCount = await tx.booking.count({ where: { roomId } });
      if (bookingCount > 0) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'ROOM_HAS_BOOKINGS',
          'Room has bookings; set isActive to false instead',
        );
      }

      await tx.roomImage.deleteMany({ where: { roomId } });
      await tx.room.delete({ where: { id: roomId } });
    });
  }

  // ---------- Internal ----------

  // ล็อกแถวห้องแบบเดียวกับ bookings.service.ts ต้องเรียกเป็นอย่างแรกใน transaction
  private lockRoom(tx: Prisma.TransactionClient, roomId: string) {
    return tx.$queryRaw`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;
  }

  // เรียง createdAt DESC, id DESC และแบ่งหน้าตามข้อตกลงกลาง
  private async list(
    where: Prisma.RoomWhereInput,
    { page, limit }: PaginationDto,
  ) {
    const [rooms, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where,
        include: ROOM_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.room.count({ where }),
    ]);

    return {
      data: rooms.map((room) => toRoomResponse(room)),
      meta: paginationMeta(page, limit, total),
    };
  }
}
