import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class AdminUpdateBookingStatusDto {
  @IsString()
  @IsIn(['APPROVED', 'PAID', 'CANCELLED'])
  @ApiProperty({
    enum: ['APPROVED', 'PAID', 'CANCELLED'],
    description:
      'PENDING → APPROVED → PAID; PENDING/APPROVED → CANCELLED before checkIn',
  })
  status: 'APPROVED' | 'PAID' | 'CANCELLED';
}
