import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListBookingsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  @ApiPropertyOptional({ enum: BookingStatus })
  status?: BookingStatus;
}

export class AdminListBookingsDto extends ListBookingsDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ format: 'uuid' })
  userId?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ format: 'uuid' })
  roomId?: string;
}
