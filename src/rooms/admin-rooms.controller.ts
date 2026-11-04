import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminListRoomsDto } from './dto/admin-list-rooms.dto';
import { RoomsService } from './rooms.service';

@Controller('admin/rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminRoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // GET /admin/rooms — รวม Active/Inactive กรองด้วย ?isActive=true|false ได้
  @Get()
  async findAll(@Query() query: AdminListRoomsDto) {
    const { data, meta } = await this.roomsService.findAllForAdmin(query);
    return { data, message: 'Rooms retrieved', meta };
  }

  // GET /admin/rooms/:roomId — ห้องทุกสถานะ
  @Get(':roomId')
  async findOne(@Param('roomId', ParseUUIDPipe) roomId: string) {
    const data = await this.roomsService.findOneForAdmin(roomId);
    return { data, message: 'Room retrieved' };
  }
}
