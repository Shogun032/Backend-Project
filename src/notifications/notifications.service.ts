
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        booking: {
          userId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      data: notifications,
      message: 'Notifications retrieved successfully',
    };
  }
}
