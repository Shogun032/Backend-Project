import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateBookingStatusDto {
  @IsString()
  @IsIn(['CANCELLED'])
  @ApiProperty({
    enum: ['CANCELLED'],
    description: 'Owner cancellation is allowed only before checkIn',
  })
  status: 'CANCELLED';
}
