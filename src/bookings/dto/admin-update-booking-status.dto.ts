import { IsIn, IsString } from 'class-validator';

export class AdminUpdateBookingStatusDto {
  @IsString()
  @IsIn(['APPROVED', 'PAID', 'CANCELLED'])
  status: 'APPROVED' | 'PAID' | 'CANCELLED';
}
