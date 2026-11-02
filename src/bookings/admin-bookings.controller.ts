import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { BookingsService } from './bookings.service';
import { AdminUpdateBookingStatusDto } from './dto/admin-update-booking-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Admin: Get all bookings
  @Get()
  async findAll() {
    const bookings = await this.bookingsService.findAllForAdmin();

    return {
      data: bookings,
      message: 'All bookings retrieved successfully',
    };
  }

  // Admin: Get booking details
  @Get(':bookingId')
  async findOne(@Param('bookingId') bookingId: string) {
    const booking = await this.bookingsService.findOneForAdmin(bookingId);

    return {
      data: booking,
      message: 'Booking retrieved successfully',
    };
  }

  // Admin: Update booking status
  @Patch(':bookingId/status')
  async updateStatus(
    @Param('bookingId') bookingId: string,
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
