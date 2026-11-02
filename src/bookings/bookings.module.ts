import { Module } from '@nestjs/common';
import { TokenModule } from '../auth/token.module';
import { BookingsController } from './bookings.controller';
import { AdminBookingsController } from './admin-bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [TokenModule],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
