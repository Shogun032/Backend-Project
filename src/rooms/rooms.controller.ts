import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import {
  RoomListResponseDto,
  RoomResponseEnvelopeDto,
} from './dto/room-response.dto';
import {
  roomAuthErrors,
  roomNotFoundError,
  roomValidationError,
} from './room-api-errors';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { SearchRoomsDto } from './dto/search-rooms.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // GET /rooms — ทุกคน เฉพาะห้อง Active
  @ApiOperation({ summary: 'List active rooms' })
  @ApiOkResponse({ type: RoomListResponseDto })
  @ApiErrorResponses(roomValidationError)
  @Get()
  async findAll(@Query() query: PaginationDto) {
    const { data, meta } = await this.roomsService.findAll(query);
    return { data, message: 'Rooms retrieved', meta };
  }

  // GET /rooms/search — ทุกคน ต้องประกาศก่อน @Get(':roomId')
  // ไม่อย่างนั้นคำว่า "search" จะถูกจับเป็น roomId
  @ApiOperation({
    summary: 'Search available rooms',
    description:
      'Uses [checkIn, checkOut); PENDING, APPROVED and PAID bookings block availability. Dates follow Asia/Bangkok.',
  })
  @ApiOkResponse({ type: RoomListResponseDto })
  @ApiErrorResponses(roomValidationError)
  @Get('search')
  async search(@Query() query: SearchRoomsDto) {
    const { data, meta } = await this.roomsService.search(query);
    return { data, message: 'Available rooms retrieved', meta };
  }

  // GET /rooms/:roomId — ทุกคน ห้อง Inactive คืน 404
  @ApiOperation({ summary: 'Get an active room' })
  @ApiOkResponse({ type: RoomResponseEnvelopeDto })
  @ApiErrorResponses(roomValidationError, roomNotFoundError)
  @Get(':roomId')
  async findOne(@Param('roomId', ParseUUIDPipe) roomId: string) {
    const data = await this.roomsService.findOne(roomId);
    return { data, message: 'Room retrieved' };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a room (Admin)' })
  @ApiCreatedResponse({
    type: RoomResponseEnvelopeDto,
    headers: {
      Location: {
        description: 'Admin detail URL of the created room',
        schema: { type: 'string' },
      },
    },
  })
  @ApiErrorResponses(roomValidationError, ...roomAuthErrors)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body() dto: CreateRoomDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.roomsService.create(dto);
    res.location(`/api/v1/admin/rooms/${data.id}`);
    return { data, message: 'Room created' };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a room (Admin)',
    description:
      'Provide at least one field. Sending images replaces the entire image list.',
  })
  @ApiOkResponse({ type: RoomResponseEnvelopeDto })
  @ApiErrorResponses(
    roomValidationError,
    roomNotFoundError,
    ...roomAuthErrors,
    {
      status: 409,
      code: 'ROOM_CAPACITY_CONFLICT',
      message: 'Capacity is lower than guests of an active booking',
    },
  )
  @Patch(':roomId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    const data = await this.roomsService.update(roomId, dto);
    return { data, message: 'Room updated' };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a room without booking history (Admin)' })
  @ApiNoContentResponse({ description: 'Room deleted' })
  @ApiErrorResponses(
    roomValidationError,
    roomNotFoundError,
    ...roomAuthErrors,
    {
      status: 409,
      code: 'ROOM_HAS_BOOKINGS',
      message: 'Room has bookings; set isActive to false instead',
    },
  )
  @Delete(':roomId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('roomId', ParseUUIDPipe) roomId: string): Promise<void> {
    await this.roomsService.remove(roomId);
  }
}
