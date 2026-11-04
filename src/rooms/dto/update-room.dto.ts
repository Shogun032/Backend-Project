import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  OptionalField,
  PRICE_MESSAGE,
  PRICE_PATTERN,
  RoomImageDto,
  trimString,
} from './create-room.dto';

// PATCH: ทุกฟิลด์ไม่บังคับ แต่ต้องมีอย่างน้อยหนึ่งฟิลด์ (ตรวจใน RoomsService.update)
export class UpdateRoomDto {
  @OptionalField()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  name?: string;

  @OptionalField()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @OptionalField()
  @IsInt()
  @Min(1)
  capacity?: number;

  @OptionalField()
  @IsString()
  @Matches(PRICE_PATTERN, { message: PRICE_MESSAGE })
  pricePerNight?: string;

  @OptionalField()
  @IsBoolean()
  isActive?: boolean;

  // ส่ง images มา = แทนที่รูปทั้งหมดของห้อง
  @OptionalField()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomImageDto)
  images?: RoomImageDto[];
}
