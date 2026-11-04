import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// รูปแบบและกติกาวันที่ตรวจด้วย parseBookingDates ตัวเดียวกับการสร้างการจอง
export class SearchRoomsDto extends PaginationDto {
  @IsString()
  checkIn!: string;

  @IsString()
  checkOut!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests!: number;
}