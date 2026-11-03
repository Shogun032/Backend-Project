import { Body,Controller,Delete,Get,HttpCode,HttpStatus,Param,ParseUUIDPipe,Patch,Post,Query,Res,UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { SearchRoomsDto } from './dto/search-rooms.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // GET /rooms — ทุกคน เฉพาะห้อง Active
  @Get()
  async findAll(@Query() query: PaginationDto) {
    const { data, meta } = await this.roomsService.findAll(query);
    return { data, message: 'Rooms retrieved', meta };
  }

  // GET /rooms/search — ทุกคน ต้องประกาศก่อน @Get(':roomId')
  // ไม่อย่างนั้นคำว่า "search" จะถูกจับเป็น roomId
  @Get('search')
  async search(@Query() query: SearchRoomsDto) {
    const { data, meta } = await this.roomsService.search(query);
    return { data, message: 'Available rooms retrieved', meta };
  }

  // GET /rooms/:roomId — ทุกคน ห้อง Inactive คืน 404
  @Get(':roomId')
  async findOne(@Param('roomId', ParseUUIDPipe) roomId: string) {
    const data = await this.roomsService.findOne(roomId);
    return { data, message: 'Room retrieved' };
  }

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

  @Delete(':roomId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('roomId', ParseUUIDPipe) roomId: string): Promise<void> {
    await this.roomsService.remove(roomId);
  }
}