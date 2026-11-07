import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiProperty({ enum: ['BOOKING_CREATED', 'BOOKING_CANCELLED'] })
  type: string;

  @ApiProperty({ example: 'Your booking has been created' })
  message: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  data: NotificationResponseDto[];

  @ApiProperty()
  message: string;

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
