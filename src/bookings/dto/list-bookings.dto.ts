import { BookingStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListBookingsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}

export class AdminListBookingsDto extends ListBookingsDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;
}
