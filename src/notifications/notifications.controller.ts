import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findMyNotifications(
    @Req() request: AuthenticatedRequest,
    @Query() query: PaginationDto,
  ) {
    return this.notificationsService.findMyNotifications(
      request.user.id,
      query,
    );
  }
}
