import { Module } from '@nestjs/common';
import { TokenModule } from '../auth/token.module';
import { AdminRoomsController } from './admin-rooms.controller';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  // JwtAuthGuard ต้องใช้ JwtService ให้ imports ตรงกับ bookings.module.ts
  imports: [TokenModule],
  controllers: [RoomsController, AdminRoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
