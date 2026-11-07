import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// ไม่ส่งฟิลด์มา = ข้ามการตรวจได้ แต่ถ้าส่ง null มาจะไม่ผ่าน
// (ต่างจาก @IsOptional ที่ปล่อย null ผ่านไปจน Prisma error เป็น 500)
export const OptionalField = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);

// decimal string มากกว่า 0 ไม่เกิน 9,999,999.99 ทศนิยมไม่เกิน 2 ตำแหน่ง เช่น "1500.00"
export const PRICE_PATTERN = /^(?!0+(\.0{1,2})?$)\d{1,7}(\.\d{1,2})?$/;
export const PRICE_MESSAGE =
  'pricePerNight must be a decimal string greater than 0, e.g. "1500.00"';

export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RoomImageDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  @ApiProperty({
    format: 'uri',
    example: 'https://example.com/room.jpg',
    maxLength: 500,
  })
  url!: string;

  @OptionalField()
  @IsString()
  @MaxLength(200)
  @ApiPropertyOptional({ maxLength: 200, example: 'Bedroom' })
  altText?: string;

  @OptionalField()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ minimum: 0, default: 0 })
  sortOrder?: number;
}

export class CreateRoomDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  @ApiProperty({ minLength: 1, maxLength: 100, example: 'Deluxe Double' })
  name!: string;

  @OptionalField()
  @IsString()
  @MaxLength(2000)
  @ApiPropertyOptional({ maxLength: 2000, example: 'Room with city view' })
  description?: string;

  @IsInt()
  @Min(1)
  @ApiProperty({ minimum: 1, example: 2 })
  capacity!: number;

  @IsString()
  @Matches(PRICE_PATTERN, { message: PRICE_MESSAGE })
  @ApiProperty({
    type: String,
    pattern: PRICE_PATTERN.source,
    example: '1800.00',
  })
  pricePerNight!: string;

  @OptionalField()
  @IsBoolean()
  @ApiPropertyOptional({ default: true })
  isActive?: boolean;

  @OptionalField()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomImageDto)
  @ApiPropertyOptional({ type: [RoomImageDto] })
  images?: RoomImageDto[];
}
