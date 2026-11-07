import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { NotificationListResponseDto } from './dto/notification-response.dto';
import {
  bookingValidationError,
  bookingAuthErrors,
} from '../bookings/booking-api-errors';
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({
    summary: 'List my booking notifications',
    description:
      'Creation and cancellation events belong to the booking owner, including when an Admin cancels the booking.',
  })
  @ApiOkResponse({ type: NotificationListResponseDto })
  @ApiErrorResponses(bookingValidationError, ...bookingAuthErrors)
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
