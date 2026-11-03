import { Transform, Type } from 'class-transformer';
import { IsArray,IsBoolean,IsInt,IsOptional,IsString,IsUrl,Length,Matches,MaxLength,Min,ValidateNested } from 'class-validator';

export class RoomImageDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;

  @IsString()
  @MaxLength(200)
  altText!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpdateRoomDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  // decimal string เช่น "1500.00" ต้องมากกว่า 0 และไม่เกิน 9,999,999.99
  @IsOptional()
  @IsString()
  @Matches(/^(?!0+(\.0{1,2})?$)\d{1,7}(\.\d{1,2})?$/, {
    message:
      'pricePerNight must be a decimal string greater than 0, e.g. "1500.00"',
  })
  pricePerNight?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomImageDto)
  images?: RoomImageDto[];
}