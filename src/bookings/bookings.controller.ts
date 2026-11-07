import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import {
  BookingListResponseDto,
  BookingResponseEnvelopeDto,
} from './dto/booking-response.dto';
import {
  bookingValidationError,
  bookingNotFoundError,
  bookingUnavailableError,
  bookingTransitionError,
  bookingAuthErrors,
} from './booking-api-errors';
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

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Create a new booking
  @ApiOperation({
    summary: 'Create a booking for the logged-in user',
    description:
      'Checks active room, capacity and overlapping PENDING/APPROVED/PAID bookings in one transaction. Prices are snapshots from the server.',
  })
  @ApiCreatedResponse({
    type: BookingResponseEnvelopeDto,
    headers: {
      Location: {
        description: 'URL of the created booking',
        schema: { type: 'string' },
      },
    },
  })
  @ApiErrorResponses(
    bookingValidationError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Room not found' },
    bookingUnavailableError,
    ...bookingAuthErrors,
  )
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
  @ApiOperation({
    summary: 'List my bookings',
    description: 'Even Admin sees only their own bookings through this route.',
  })
  @ApiOkResponse({ type: BookingListResponseDto })
  @ApiErrorResponses(bookingValidationError, ...bookingAuthErrors)
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
  @ApiOperation({
    summary: 'Get my booking',
    description:
      'Returns 404 for missing bookings and bookings owned by someone else.',
  })
  @ApiOkResponse({ type: BookingResponseEnvelopeDto })
  @ApiErrorResponses(
    bookingValidationError,
    bookingNotFoundError,
    ...bookingAuthErrors,
  )
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
  @ApiOperation({
    summary: 'Cancel my booking',
    description:
      'PENDING/APPROVED can be cancelled before checkIn (Asia/Bangkok). Repeating CANCELLED returns the same booking without another notification.',
  })
  @ApiOkResponse({ type: BookingResponseEnvelopeDto })
  @ApiErrorResponses(
    bookingValidationError,
    bookingNotFoundError,
    bookingTransitionError,
    ...bookingAuthErrors,
  )
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
