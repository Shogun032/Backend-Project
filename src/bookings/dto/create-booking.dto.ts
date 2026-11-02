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
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkIn: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOut: string;

  @IsInt()
  @Min(1)
  guests: number;
}