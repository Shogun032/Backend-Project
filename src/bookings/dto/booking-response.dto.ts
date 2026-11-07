import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';

export class BookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  roomId: string;

  @ApiProperty({ format: 'date', example: '2027-01-10' })
  checkIn: string;

  @ApiProperty({ format: 'date', example: '2027-01-12' })
  checkOut: string;

  @ApiProperty({ minimum: 1, example: 2 })
  guests: number;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty({ minimum: 1, example: 2 })
  nights: number;

  @ApiProperty({
    type: String,
    example: '1500.00',
    description: 'Price snapshot at booking creation',
  })
  pricePerNight: string;

  @ApiProperty({ type: String, example: '3000.00' })
  totalPrice: string;

  @ApiProperty({ enum: ['THB'] })
  currency: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class BookingResponseEnvelopeDto {
  @ApiProperty({ type: BookingResponseDto })
  data: BookingResponseDto;

  @ApiProperty()
  message: string;
}

export class BookingListResponseDto {
  @ApiProperty({ type: [BookingResponseDto] })
  data: BookingResponseDto[];

  @ApiProperty()
  message: string;

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
