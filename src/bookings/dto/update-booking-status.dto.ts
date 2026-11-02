import { IsIn, IsString } from 'class-validator';

export class UpdateBookingStatusDto {
  @IsString()
  @IsIn(['CANCELLED'])
  status: 'CANCELLED';
}
