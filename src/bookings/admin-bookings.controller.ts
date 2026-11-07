import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import {
  BookingListResponseDto,
  BookingResponseEnvelopeDto,
} from './dto/booking-response.dto';
import {
  bookingValidationError,
  bookingNotFoundError,
  bookingTransitionError,
  bookingAuthErrors,
  bookingForbiddenError,
} from './booking-api-errors';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { BookingsService } from './bookings.service';
import { AdminListBookingsDto } from './dto/list-bookings.dto';
import { AdminUpdateBookingStatusDto } from './dto/admin-update-booking-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin Bookings')
@ApiBearerAuth()
@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Admin: Get all bookings
  @ApiOperation({ summary: 'List all bookings (Admin)' })
  @ApiOkResponse({ type: BookingListResponseDto })
  @ApiErrorResponses(
    bookingValidationError,
    bookingForbiddenError,
    ...bookingAuthErrors,
  )
  @Get()
  async findAll(@Query() query: AdminListBookingsDto) {
    const bookings = await this.bookingsService.findAllForAdmin(query);

    return {
      ...bookings,
      message: 'All bookings retrieved successfully',
    };
  }

  // Admin: Get booking details
  @ApiOperation({ summary: 'Get any booking (Admin)' })
  @ApiOkResponse({ type: BookingResponseEnvelopeDto })
  @ApiErrorResponses(
    bookingValidationError,
    bookingNotFoundError,
    bookingForbiddenError,
    ...bookingAuthErrors,
  )
  @Get(':bookingId')
  async findOne(@Param('bookingId', new ParseUUIDPipe()) bookingId: string) {
    const booking = await this.bookingsService.findOneForAdmin(bookingId);

    return {
      data: booking,
      message: 'Booking retrieved successfully',
    };
  }

  // Admin: Update booking status
  @ApiOperation({
    summary: 'Change booking status (Admin)',
    description:
      'PENDING → APPROVED → PAID by checkIn; PENDING/APPROVED → CANCELLED only before checkIn. Invalid transitions return INVALID_STATUS_TRANSITION; approval conflicts return ROOM_UNAVAILABLE (both 409). Repeated status requests do not create duplicate notifications.',
  })
  @ApiOkResponse({ type: BookingResponseEnvelopeDto })
  @ApiErrorResponses(
    bookingValidationError,
    bookingNotFoundError,
    bookingForbiddenError,
    bookingTransitionError,
    ...bookingAuthErrors,
  )
  @Patch(':bookingId/status')
  async updateStatus(
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: AdminUpdateBookingStatusDto,
  ) {
    const booking = await this.bookingsService.updateStatusByAdmin(
      bookingId,
      dto.status,
    );

    return {
      data: booking,
      message: 'Booking status updated successfully',
    };
  }
}
