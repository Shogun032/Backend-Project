import { ApiProperty } from '@nestjs/swagger';

export class RoomImageResponseDto {
  @ApiProperty({ format: 'uri' })
  url: string;

  @ApiProperty()
  altText: string;

  @ApiProperty({ minimum: 0 })
  sortOrder: number;
}

export class RoomResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ minimum: 1 })
  capacity: number;

  @ApiProperty({ type: String, example: '1800.00' })
  pricePerNight: string;

  @ApiProperty({ enum: ['THB'] })
  currency: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: [RoomImageResponseDto] })
  images: RoomImageResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class RoomResponseEnvelopeDto {
  @ApiProperty({ type: RoomResponseDto })
  data: RoomResponseDto;

  @ApiProperty()
  message: string;
}

export class RoomPaginationMetaDto {
  @ApiProperty({ minimum: 1 })
  page: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit: number;

  @ApiProperty({ minimum: 0 })
  total: number;

  @ApiProperty({ minimum: 0 })
  totalPages: number;
}

export class RoomListResponseDto {
  @ApiProperty({ type: [RoomResponseDto] })
  data: RoomResponseDto[];

  @ApiProperty()
  message: string;

  @ApiProperty({ type: RoomPaginationMetaDto })
  meta: RoomPaginationMetaDto;
}
