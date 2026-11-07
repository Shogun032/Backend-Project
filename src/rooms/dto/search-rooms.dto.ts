import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// รูปแบบและกติกาวันที่ตรวจด้วย parseBookingDates ตัวเดียวกับการสร้างการจอง
export class SearchRoomsDto extends PaginationDto {
  @IsString()
  @ApiProperty({ format: 'date', example: '2027-01-10' })
  checkIn!: string;

  @IsString()
  @ApiProperty({ format: 'date', example: '2027-01-12' })
  checkOut!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiProperty({ minimum: 1, example: 2 })
  guests!: number;
}
