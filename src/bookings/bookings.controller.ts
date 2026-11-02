import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  Patch,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Create a new booking
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBookingDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const booking = await this.bookingsService.create(request.user.id, dto);

    response.setHeader('Location', `/api/v1/bookings/${booking.id}`);
    return {
      data: booking,
      message: 'Booking created successfully',
    };
  }

  // Get all bookings belonging to the logged-in user
  @Get()
  async findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListBookingsDto,
  ) {
    const bookings = await this.bookingsService.findAllByUser(
      request.user.id,
      query,
    );

    return {
      ...bookings,
      message: 'Bookings retrieved successfully',
    };
  }

  // Get booking details by ID
  @Get(':bookingId')
  async findOne(
    @Req() request: AuthenticatedRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    const booking = await this.bookingsService.findOneByUser(
      bookingId,
      request.user.id,
    );

    return {
      data: booking,
      message: 'Booking retrieved successfully',
    };
  }

  // Cancel a booking
  @Patch(':bookingId/status')
  async cancel(
    @Req() request: AuthenticatedRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    const booking = await this.bookingsService.cancel(
      bookingId,
      request.user.id,
      dto.status,
    );

    return {
      data: booking,
      message: 'Booking cancelled successfully',
    };
  }
}
