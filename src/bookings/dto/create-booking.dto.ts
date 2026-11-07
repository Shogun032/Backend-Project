import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  @ApiProperty({ format: 'uuid' })
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @ApiProperty({
    format: 'date',
    example: '2027-01-10',
    description: 'YYYY-MM-DD; today or later in Asia/Bangkok',
  })
  checkIn: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @ApiProperty({
    format: 'date',
    example: '2027-01-12',
    description: 'Must be after checkIn; checkout is excluded from the stay',
  })
  checkOut: string;

  @IsInt()
  @Min(1)
  @ApiProperty({ minimum: 1, example: 2 })
  guests: number;
}
