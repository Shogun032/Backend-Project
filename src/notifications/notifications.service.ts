import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginationMeta } from '../common/dto/pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyNotifications(userId: string, query: PaginationDto) {
    const { page, limit } = query;
    const where = { booking: { userId } };
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { booking: { select: { userId: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      data: notifications.map(
        ({ id, bookingId, type, message, createdAt, booking }) => ({
          id,
          userId: booking.userId,
          bookingId,
          type,
          message,
          createdAt,
        }),
      ),
      message: 'Notifications retrieved',
      meta: paginationMeta(page, limit, total),
    };
  }
}
