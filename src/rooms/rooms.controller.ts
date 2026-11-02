import { Controller, Get } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async findAll() {
    return {
      data: await this.roomsService.findAll(),
      message: 'Rooms retrieved successfully',
    };
  }
}